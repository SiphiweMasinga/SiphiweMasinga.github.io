// Interactive 3D hero scene: a glowing crystal core, orbit rings and a star field that
// follow the mouse and react to scrolling. Falls back to the CSS glow if WebGL is missing.
(() => {
  const canvas = document.querySelector(".hero-canvas");
  const hero = document.querySelector(".hero");
  if (!canvas || !hero || typeof THREE === "undefined") return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 9;

  const cyan = new THREE.Color("#5ce1e6");
  const violet = new THREE.Color("#8b5cf6");
  const pink = new THREE.Color("#f472b6");

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const lightA = new THREE.PointLight(cyan, 2.2, 30);
  lightA.position.set(5, 4, 6);
  scene.add(lightA);
  const lightB = new THREE.PointLight(pink, 1.8, 30);
  lightB.position.set(-5, -3, 4);
  scene.add(lightB);

  // Everything that tilts with the mouse lives in this group.
  const group = new THREE.Group();
  scene.add(group);

  // Solid faceted core.
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.35, 0),
    new THREE.MeshStandardMaterial({
      color: violet,
      emissive: new THREE.Color("#2a1660"),
      metalness: 0.35,
      roughness: 0.25,
      flatShading: true,
    }),
  );
  group.add(core);

  // Wireframe shell around the core.
  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.1, 1)),
    new THREE.LineBasicMaterial({ color: cyan, transparent: true, opacity: 0.55 }),
  );
  group.add(shell);

  // Vertices of the shell glow as small nodes.
  const nodes = new THREE.Points(
    new THREE.IcosahedronGeometry(2.1, 1),
    new THREE.PointsMaterial({ color: cyan, size: 0.09, transparent: true, opacity: 0.9 }),
  );
  group.add(nodes);

  // Two tilted orbit rings, each carrying a small satellite.
  const rings = [
    { radius: 3.1, tilt: [1.15, 0.2, 0], color: violet, speed: 0.5 },
    { radius: 3.7, tilt: [1.7, -0.5, 0.3], color: pink, speed: -0.32 },
  ].map(({ radius, tilt, color, speed }) => {
    const pivot = new THREE.Group();
    pivot.rotation.set(...tilt);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.012, 8, 160),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }),
    );
    const satellite = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 16),
      new THREE.MeshBasicMaterial({ color }),
    );
    satellite.position.x = radius;
    const spinner = new THREE.Group();
    spinner.add(satellite);
    pivot.add(ring, spinner);
    group.add(pivot);
    return { spinner, speed, materials: [ring.material, satellite.material] };
  });

  // Star field, coloured across the brand gradient.
  const starCount = window.innerWidth < 700 ? 700 : 1400;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const palette = [cyan, violet, pink, new THREE.Color("#ffffff")];
  const starTint = new Uint8Array(starCount);
  for (let i = 0; i < starCount; i += 1) {
    starTint[i] = i % palette.length;
    const radius = 6 + Math.random() * 18;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi) - 6;
    const color = palette[i % palette.length];
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    }),
  );
  scene.add(stars);

  // Colours for each theme: light mode uses deeper tones so the scene reads on a pale page.
  const themes = {
    dark: {
      core: "#8b5cf6", emissive: "#2a1660", line: "#5ce1e6", lineOpacity: 0.55,
      rings: ["#8b5cf6", "#f472b6"], stars: ["#5ce1e6", "#8b5cf6", "#f472b6", "#ffffff"],
      starOpacity: 0.8, light: 2.2,
    },
    light: {
      core: "#7c3aed", emissive: "#3b1d8f", line: "#0e7490", lineOpacity: 0.65,
      rings: ["#7c3aed", "#db2777"], stars: ["#0e7490", "#7c3aed", "#db2777", "#475569"],
      starOpacity: 0.5, light: 1.6,
    },
  };

  function applyTheme(name) {
    const theme = themes[name] ?? themes.dark;
    core.material.color.set(theme.core);
    core.material.emissive.set(theme.emissive);
    shell.material.color.set(theme.line);
    shell.material.opacity = theme.lineOpacity;
    nodes.material.color.set(theme.line);
    rings.forEach(({ materials }, index) => materials.forEach((m) => m.color.set(theme.rings[index])));
    const starColors = theme.stars.map((hex) => new THREE.Color(hex));
    for (let i = 0; i < starCount; i += 1) {
      const color = starColors[starTint[i]];
      colors.set([color.r, color.g, color.b], i * 3);
    }
    starGeometry.attributes.color.needsUpdate = true;
    stars.material.opacity = theme.starOpacity;
    lightA.intensity = theme.light;
    render();
  }

  // Layout: the core sits to the right of the text on wide screens and behind it on phones.
  function resize() {
    const { clientWidth: width, clientHeight: height } = hero;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const wide = width > 980;
    group.position.x = wide ? 3.4 : 0;
    group.position.y = wide ? 0 : 1.2;
    group.scale.setScalar(wide ? 1 : 0.8);
    canvas.style.opacity = wide ? "1" : "0.55";
    render();
  }

  const pointer = { x: 0, y: 0 };
  const smoothed = { x: 0, y: 0 };
  window.addEventListener(
    "pointermove",
    (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );

  function render() {
    renderer.render(scene, camera);
  }

  const clock = new THREE.Clock();
  let running = false;
  let frame;

  function animate() {
    const elapsed = clock.getElapsedTime();
    const scroll = Math.min(window.scrollY / window.innerHeight, 1.2);

    smoothed.x += (pointer.x - smoothed.x) * 0.05;
    smoothed.y += (pointer.y - smoothed.y) * 0.05;

    group.rotation.y = elapsed * 0.15 + smoothed.x * 0.6 + scroll * 1.5;
    group.rotation.x = smoothed.y * 0.4 + scroll * 0.6;
    core.rotation.x = elapsed * 0.4;
    core.rotation.z = elapsed * 0.25;
    shell.rotation.y = -elapsed * 0.1;
    nodes.rotation.y = shell.rotation.y;
    rings.forEach(({ spinner, speed }) => {
      spinner.rotation.z = elapsed * speed;
    });
    stars.rotation.y = elapsed * 0.01 + smoothed.x * 0.08;
    stars.rotation.x = smoothed.y * 0.05;
    camera.position.z = 9 + scroll * 4;

    render();
    frame = requestAnimationFrame(animate);
  }

  function start() {
    if (running || prefersReducedMotion) return;
    running = true;
    animate();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  applyTheme(document.documentElement.dataset.theme);
  window.addEventListener("themechange", (event) => applyTheme(event.detail.theme));

  if (prefersReducedMotion) {
    group.rotation.set(0.3, 0.6, 0);
    render();
    return;
  }

  // Only animate while the hero is on screen, to save battery.
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(hero);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
})();
