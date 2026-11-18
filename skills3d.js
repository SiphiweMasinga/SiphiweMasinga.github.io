// 3D skills galaxy: technology logos are extruded into solid, lit 3D models that orbit a
// glowing core on three tilted rings — one ring per skill category. Logos burst out of the
// core when the section first appears, face the viewer, flip now and then, pause and grow
// when hovered, and the whole system can be dragged to tilt it.
// If WebGL or the loader is unavailable, the text sphere from script.js stays in place.
(() => {
  const container = document.querySelector(".skill-sphere");
  const logos = window.TECH_LOGOS;
  if (!container || !logos || typeof THREE === "undefined" || !THREE.SVGLoader) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.className = "skills-canvas";

  // ---------- Categories (one orbit each) ----------

  const categories = [
    {
      label: "Languages",
      names: ["Python", "Java", "JavaScript", "TypeScript", "C#", "C++", "Kotlin"],
      radius: 1.55,
      tilt: [0.95, 0, 0.35],
      speed: 0.32,
      colors: { dark: "#5ce1e6", light: "#0e7490" },
    },
    {
      label: "Web & dev tools",
      names: ["React", "Django", "Android", "HTML5", "CSS", "Git", "GitHub"],
      radius: 2.35,
      tilt: [0.85, 0, -0.45],
      speed: -0.22,
      colors: { dark: "#8b5cf6", light: "#7c3aed" },
    },
    {
      label: "Data & cloud",
      names: [],
      radius: 3.1,
      tilt: [1.1, 0, 0.12],
      speed: 0.15,
      colors: { dark: "#f472b6", light: "#db2777" },
    },
  ];
  const categoryFor = (name) =>
    categories.find((category) => category.names.includes(name)) ?? categories[2];

  const tooltip = document.createElement("span");
  tooltip.className = "logo-tooltip mono";
  tooltip.hidden = true;

  const legend = document.createElement("ul");
  legend.className = "orbit-legend mono";
  categories.forEach((category, index) => {
    const item = document.createElement("li");
    item.innerHTML = `<span class="legend-dot legend-dot-${index}"></span>${category.label}`;
    legend.append(item);
  });

  container.append(renderer.domElement, tooltip, legend);
  container.classList.add("is-3d");

  // ---------- Scene ----------

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 10.5;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(3, 4, 6);
  scene.add(keyLight);
  const coreLight = new THREE.PointLight(0x8b5cf6, 1.6, 12);
  scene.add(coreLight);
  const rimLight = new THREE.PointLight(0xf472b6, 0.8, 20);
  rimLight.position.set(5, -3, 3);
  scene.add(rimLight);

  // Everything that tilts with dragging and the mouse.
  const system = new THREE.Group();
  scene.add(system);

  // Glowing core: a faceted crystal inside a wireframe shell, with a soft halo sprite.
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b5cf6,
    emissive: 0x4c1d95,
    metalness: 0.3,
    roughness: 0.2,
    flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 0), coreMaterial);
  const coreShellMaterial = new THREE.LineBasicMaterial({ color: 0x5ce1e6, transparent: true, opacity: 0.5 });
  const coreShell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.75, 1)),
    coreShellMaterial,
  );
  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = haloCanvas.height = 128;
  const haloContext = haloCanvas.getContext("2d");
  const haloGradient = haloContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  haloGradient.addColorStop(0, "rgba(255,255,255,0.9)");
  haloGradient.addColorStop(0.25, "rgba(255,255,255,0.35)");
  haloGradient.addColorStop(1, "rgba(255,255,255,0)");
  haloContext.fillStyle = haloGradient;
  haloContext.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(haloCanvas),
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(2.6);
  system.add(halo, core, coreShell);

  // Orbit rings, each with a fast "comet" racing around it.
  const rings = categories.map((category) => {
    const pivot = new THREE.Group();
    pivot.rotation.set(...category.tilt);
    system.add(pivot);

    const points = [];
    for (let i = 0; i <= 128; i += 1) {
      const angle = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * category.radius, 0, Math.sin(angle) * category.radius));
    }
    const lineMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 });
    pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));

    const cometMaterial = new THREE.MeshBasicMaterial();
    const comet = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), cometMaterial);
    pivot.add(comet);

    return { category, pivot, lineMaterial, cometMaterial, comet, cometAngle: Math.random() * 6 };
  });

  // ---------- Logos ----------

  const loader = new THREE.SVGLoader();
  const extrude = (shapeList, depth) =>
    new THREE.ExtrudeGeometry(shapeList, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.3,
      bevelSegments: 2,
      curveSegments: 10,
    });
  // SVG's y axis points down, so flip it; 24 SVG units become about 0.75 scene units.
  const finish = (geometry, offset) => {
    geometry.translate(offset.x, offset.y, offset.z);
    geometry.scale(0.031, -0.031, 0.031);
    geometry.computeVertexNormals();
    return geometry;
  };
  const material = (color) =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: color.clone().multiplyScalar(0.18),
      metalness: 0.3,
      roughness: 0.32,
      side: THREE.DoubleSide,
    });

  const items = [];
  const meshes = [];

  logos.forEach((logo) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${logo.path}"/></svg>`;
    const shapes = loader.parse(svg).paths.flatMap((path) => THREE.SVGLoader.createShapes(path));
    if (!shapes.length) return;

    const geometry = extrude(shapes, 3);
    geometry.computeBoundingBox();
    const offset = geometry.boundingBox.getCenter(new THREE.Vector3()).negate();
    const mesh = new THREE.Mesh(finish(geometry, offset), material(new THREE.Color(logo.color)));

    // Lettering cut out of a logo (the "JS" in JavaScript, "C#", "TS", "C++") is filled with
    // raised letters in a contrasting colour so it stays readable in 3D.
    if (logo.inset) {
      const letters = shapes.flatMap((shape) => shape.holes.map((hole) => new THREE.Shape(hole.getPoints())));
      if (letters.length) {
        offset.z += 0.3;
        mesh.add(new THREE.Mesh(finish(extrude(letters, 3.6), offset), material(new THREE.Color(logo.inset))));
      }
    }

    const ring = rings[categories.indexOf(categoryFor(logo.name))];
    const holder = new THREE.Group();
    holder.add(mesh);
    ring.pivot.add(holder);

    const item = {
      logo,
      ring,
      holder,
      mesh,
      angle: 0,
      scale: 1,
      flipStart: -1,
      nextFlip: 3 + Math.random() * 10,
      wobble: Math.random() * Math.PI * 2,
    };
    mesh.userData.item = item;
    items.push(item);
    meshes.push(mesh);
  });

  // Space the logos evenly around their own ring.
  rings.forEach((ring) => {
    const ringItems = items.filter((item) => item.ring === ring);
    ringItems.forEach((item, index) => {
      item.angle = (index / ringItems.length) * Math.PI * 2 + rings.indexOf(ring) * 0.6;
    });
  });

  // ---------- Theme ----------

  function applyTheme(theme) {
    const light = theme === "light";
    rings.forEach(({ category, lineMaterial, cometMaterial }) => {
      const color = category.colors[light ? "light" : "dark"];
      lineMaterial.color.set(color);
      lineMaterial.opacity = light ? 0.5 : 0.35;
      cometMaterial.color.set(color);
    });
    coreMaterial.color.set(light ? 0x7c3aed : 0x8b5cf6);
    coreShellMaterial.color.set(light ? 0x0e7490 : 0x5ce1e6);
    halo.material.opacity = light ? 0.35 : 0.55;
    items.forEach(({ mesh, logo }) => {
      const color = new THREE.Color(light && logo.lightColor ? logo.lightColor : logo.color);
      mesh.material.color.copy(color);
      mesh.material.emissive.copy(color).multiplyScalar(light ? 0.08 : 0.18);
    });
    render();
  }

  // ---------- Layout and rendering ----------

  function resize() {
    const size = container.clientWidth;
    renderer.setSize(size, size, false);
    render();
  }

  function render() {
    renderer.render(scene, camera);
  }

  const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const parentRotation = new THREE.Quaternion();

  // Places every logo on its ring for the current moment. `intro` runs 0 → 1 as logos burst
  // out of the core; each logo starts a little after the previous one.
  function layout(elapsed, intro) {
    items.forEach((item, index) => {
      const delay = index * 0.045;
      const progress = Math.min(Math.max((intro - delay) / 0.5, 0), 1);
      const reach = progress === 1 ? 1 : easeOutBack(progress);
      const { radius } = item.ring.category;

      item.holder.position.set(
        Math.cos(item.angle) * radius * reach,
        0,
        Math.sin(item.angle) * radius * reach,
      );

      // Keep each logo facing the viewer, whatever the ring's tilt.
      item.holder.updateMatrixWorld();
      item.ring.pivot.getWorldQuaternion(parentRotation);
      item.holder.quaternion.copy(parentRotation.invert());

      let flip = 0;
      if (item.flipStart >= 0) {
        const t = (elapsed - item.flipStart) / 1.1;
        if (t >= 1) {
          item.flipStart = -1;
          item.nextFlip = elapsed + 6 + Math.random() * 10;
        } else {
          flip = easeInOut(t) * Math.PI * 2;
        }
      }
      item.mesh.rotation.y = Math.sin(elapsed * 0.9 + item.wobble) * 0.35 + flip;
      item.mesh.rotation.x = Math.sin(elapsed * 0.7 + item.wobble) * 0.12;
      item.mesh.scale.setScalar(Math.max(progress, 0.001) * item.scale);
    });
  }

  // ---------- Interaction: drag to tilt, hover to inspect ----------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tilt = { x: 0.15, y: 0 };
  const tiltVelocity = { x: 0, y: 0 };
  const lean = { x: 0, y: 0 };
  let dragging = false;
  let lastPointer = null;
  let hovered = null;

  function setHovered(item, event) {
    hovered = item;
    container.style.cursor = dragging ? "grabbing" : item ? "pointer" : "grab";
    if (!item) {
      tooltip.hidden = true;
      return;
    }
    const rect = container.getBoundingClientRect();
    tooltip.textContent = `${item.logo.name} · ${item.ring.category.label}`;
    tooltip.style.left = `${event.clientX - rect.left}px`;
    tooltip.style.top = `${event.clientY - rect.top - 18}px`;
    tooltip.hidden = false;
  }

  container.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    container.setPointerCapture(event.pointerId);
    container.style.cursor = "grabbing";
  });

  container.addEventListener("pointermove", (event) => {
    const rect = container.getBoundingClientRect();
    lean.x = ((event.clientY - rect.top) / rect.height - 0.5) * 0.4;
    lean.y = ((event.clientX - rect.left) / rect.width - 0.5) * 0.6;

    if (dragging && lastPointer) {
      tiltVelocity.y = (event.clientX - lastPointer.x) * 0.008;
      tiltVelocity.x = (event.clientY - lastPointer.y) * 0.008;
      tilt.y += tiltVelocity.y;
      tilt.x = Math.max(-1.2, Math.min(1.2, tilt.x + tiltVelocity.x));
      lastPointer = { x: event.clientX, y: event.clientY };
      if (prefersReducedMotion) frameOnce();
      return;
    }

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes, true)[0];
    let target = hit?.object;
    while (target && !target.userData.item) target = target.parent;
    setHovered(target?.userData.item ?? null, event);
    if (prefersReducedMotion) frameOnce();
  });

  const endDrag = () => {
    dragging = false;
    lastPointer = null;
    container.style.cursor = "grab";
  };
  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);
  container.addEventListener("pointerleave", () => {
    endDrag();
    lean.x = 0;
    lean.y = 0;
    setHovered(null);
  });

  // ---------- Animation ----------

  const clock = new THREE.Clock(false);
  let introStart = null;
  let running = false;
  let frame;
  let previous = 0;

  function step(elapsed, delta) {
    if (!dragging) {
      // Let a flick coast to a stop.
      tiltVelocity.x *= 0.92;
      tiltVelocity.y *= 0.92;
      tilt.y += tiltVelocity.y;
      tilt.x = Math.max(-1.2, Math.min(1.2, tilt.x + tiltVelocity.x));
    }
    system.rotation.x += (tilt.x + lean.x - system.rotation.x) * 0.08;
    system.rotation.y += (tilt.y + lean.y + Math.sin(elapsed * 0.15) * 0.25 - system.rotation.y) * 0.08;

    items.forEach((item) => {
      const isHovered = item === hovered;
      if (!isHovered) item.angle += item.ring.category.speed * delta;
      item.scale += ((isHovered ? 1.55 : 1) - item.scale) * 0.15;
      if (item.flipStart < 0 && !isHovered && elapsed > item.nextFlip) item.flipStart = elapsed;
    });

    rings.forEach((ring) => {
      ring.cometAngle += ring.category.speed * 3.2 * delta;
      ring.comet.position.set(
        Math.cos(ring.cometAngle) * ring.category.radius,
        0,
        Math.sin(ring.cometAngle) * ring.category.radius,
      );
    });

    core.rotation.x = elapsed * 0.5;
    core.rotation.y = elapsed * 0.7;
    coreShell.rotation.y = -elapsed * 0.25;
    const pulse = 1 + Math.sin(elapsed * 2) * 0.06;
    core.scale.setScalar(pulse);
    halo.scale.setScalar(2.6 * pulse);
    coreLight.intensity = 1.4 + Math.sin(elapsed * 2) * 0.3;

    const intro = introStart === null ? 0 : (elapsed - introStart) / 1.6;
    layout(elapsed, Math.min(intro, 2));
    render();
  }

  function animate() {
    const elapsed = clock.getElapsedTime();
    step(elapsed, Math.min(elapsed - previous, 0.05));
    previous = elapsed;
    frame = requestAnimationFrame(animate);
  }

  // Static frame used when the visitor prefers reduced motion.
  function frameOnce() {
    system.rotation.set(tilt.x, tilt.y, 0);
    items.forEach((item) => {
      item.scale = item === hovered ? 1.3 : 1;
    });
    layout(0, 2);
    render();
  }

  window.addEventListener("resize", resize);
  window.addEventListener("themechange", (event) => applyTheme(event.detail.theme));
  applyTheme(document.documentElement.dataset.theme);
  resize();

  if (prefersReducedMotion) {
    frameOnce();
    return;
  }

  layout(0, 0);
  render();

  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !running) {
        running = true;
        if (!clock.running) clock.start();
        if (introStart === null) introStart = clock.getElapsedTime();
        previous = clock.getElapsedTime();
        animate();
      } else if (!entry.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(frame);
      }
    },
    { threshold: 0.25 },
  ).observe(container);
})();
