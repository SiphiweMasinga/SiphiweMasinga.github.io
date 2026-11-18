// 3D skills sphere: each technology logo is extruded into a solid, lit 3D model and placed
// on a sphere that spins on its own, can be dragged, and names a logo when you hover it.
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

  const tooltip = document.createElement("span");
  tooltip.className = "logo-tooltip mono";
  tooltip.hidden = true;
  container.append(renderer.domElement, tooltip);
  container.classList.add("is-3d");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 9.6;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(3, 4, 6);
  scene.add(keyLight);
  const cyanLight = new THREE.PointLight(0x5ce1e6, 1.2, 20);
  cyanLight.position.set(-5, -2, 4);
  scene.add(cyanLight);
  const pinkLight = new THREE.PointLight(0xf472b6, 1, 20);
  pinkLight.position.set(5, -3, 3);
  scene.add(pinkLight);

  const globe = new THREE.Group();
  scene.add(globe);

  // A faint wireframe shell gives the sphere its shape between the logos.
  const shellMaterial = new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.14 });
  globe.add(
    new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.45, 1)), shellMaterial),
  );

  const radius = 2.65;
  const loader = new THREE.SVGLoader();
  const meshes = [];

  logos.forEach((logo, index) => {
    // Logos with cut-out lettering (e.g. JavaScript, C#) need the even-odd rule for their holes.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${logo.path}"/></svg>`;
    const shapes = loader.parse(svg).paths.flatMap((path) => THREE.SVGLoader.createShapes(path));
    if (!shapes.length) return;

    const extrude = (shapeList, depth) =>
      new THREE.ExtrudeGeometry(shapeList, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.5,
        bevelSize: 0.3,
        bevelSegments: 2,
        curveSegments: 10,
      });
    // SVG's y axis points down, so flip it; 24 SVG units become about 1 scene unit.
    const finish = (geometry, offset) => {
      geometry.translate(offset.x, offset.y, offset.z);
      geometry.scale(0.041, -0.041, 0.041);
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

    const geometry = extrude(shapes, 3);
    geometry.computeBoundingBox();
    const offset = geometry.boundingBox.getCenter(new THREE.Vector3()).negate();
    const mesh = new THREE.Mesh(finish(geometry, offset), material(new THREE.Color(logo.color)));
    mesh.userData = { name: logo.name, phase: index * 0.7, logo };

    // Lettering cut out of a logo (the "JS" in JavaScript, the "C#" in C#) is filled with
    // raised letters in a contrasting colour so it stays readable in 3D.
    if (logo.inset) {
      const letters = shapes.flatMap((shape) =>
        shape.holes.map((hole) => new THREE.Shape(hole.getPoints())),
      );
      if (letters.length) {
        const lettering = extrude(letters, 3.6);
        offset.z += 0.3;
        mesh.add(new THREE.Mesh(finish(lettering, offset), material(new THREE.Color(logo.inset))));
      }
    }

    // Spread logos evenly (Fibonacci lattice) and turn each one to face outwards.
    const y = 1 - (index / (logos.length - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = index * Math.PI * (3 - Math.sqrt(5));
    const holder = new THREE.Group();
    holder.position.set(Math.cos(theta) * ring * radius, y * radius, Math.sin(theta) * ring * radius);
    holder.lookAt(holder.position.clone().multiplyScalar(2));
    holder.add(mesh);
    globe.add(holder);
    meshes.push(mesh);
  });

  function resize() {
    const size = container.clientWidth;
    renderer.setSize(size, size, false);
    render();
  }

  function render() {
    renderer.render(scene, camera);
  }

  // ---------- Interaction: drag to spin, hover to name ----------

  const velocity = { x: 0.0012, y: 0.004 };
  const idleVelocity = { x: 0.0012, y: 0.004 };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let dragging = false;
  let lastPointer = null;
  let hovered = null;

  function setHovered(mesh, event) {
    if (hovered && hovered !== mesh) hovered.scale.setScalar(1);
    hovered = mesh;
    container.style.cursor = dragging ? "grabbing" : mesh ? "pointer" : "grab";
    if (!mesh) {
      tooltip.hidden = true;
      return;
    }
    mesh.scale.setScalar(1.3);
    const rect = container.getBoundingClientRect();
    tooltip.textContent = mesh.userData.name;
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
    if (dragging && lastPointer) {
      velocity.y = (event.clientX - lastPointer.x) * 0.006;
      velocity.x = (event.clientY - lastPointer.y) * 0.006;
      lastPointer = { x: event.clientX, y: event.clientY };
      if (prefersReducedMotion) {
        globe.rotation.y += velocity.y;
        globe.rotation.x += velocity.x;
        render();
      }
      return;
    }

    const rect = container.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes, true)[0];
    const logoMesh = hit && (meshes.includes(hit.object) ? hit.object : hit.object.parent);
    setHovered(logoMesh || null, event);
    if (prefersReducedMotion) render();
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
    setHovered(null);
  });

  // ---------- Animation ----------

  const clock = new THREE.Clock();
  let running = false;
  let frame;

  function animate() {
    const elapsed = clock.getElapsedTime();

    if (!dragging) {
      // Ease back towards a gentle idle spin after a flick.
      velocity.x += (idleVelocity.x - velocity.x) * 0.03;
      velocity.y += (idleVelocity.y - velocity.y) * 0.03;
    }
    if (!hovered || dragging) {
      globe.rotation.y += velocity.y;
      globe.rotation.x += velocity.x;
    }

    meshes.forEach((mesh) => {
      mesh.rotation.y = Math.sin(elapsed * 1.2 + mesh.userData.phase) * 0.35;
    });

    render();
    frame = requestAnimationFrame(animate);
  }

  // Recolour for light/dark mode: a stronger wireframe on light pages, and logos such as
  // GitHub's (white) switch to their dark version.
  function applyTheme(theme) {
    const light = theme === "light";
    shellMaterial.opacity = light ? 0.28 : 0.14;
    meshes.forEach((mesh) => {
      const { logo } = mesh.userData;
      const color = new THREE.Color(light && logo.lightColor ? logo.lightColor : logo.color);
      mesh.material.color.copy(color);
      mesh.material.emissive.copy(color).multiplyScalar(light ? 0.08 : 0.18);
    });
    render();
  }

  window.addEventListener("resize", resize);
  globe.rotation.set(0.25, 0.4, 0);
  resize();
  applyTheme(document.documentElement.dataset.theme);
  window.addEventListener("themechange", (event) => applyTheme(event.detail.theme));

  if (prefersReducedMotion) return;

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) {
      running = true;
      animate();
    } else if (!entry.isIntersecting && running) {
      running = false;
      cancelAnimationFrame(frame);
    }
  }).observe(container);
})();
