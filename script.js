const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// ---------- Light / dark theme ----------

const root = document.documentElement;
const themeToggle = document.querySelector(".theme-toggle");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme, save) {
  root.dataset.theme = theme;
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  themeColorMeta.content = theme === "dark" ? "#07080d" : "#f5f6fa";
  if (save) {
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }
  // The 3D scenes listen for this and recolour themselves.
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
}

applyTheme(root.dataset.theme === "light" ? "light" : "dark", false);

themeToggle.addEventListener("click", () => {
  applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
});

// Follow the system setting until the visitor picks a theme themselves.
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
  let saved = null;
  try {
    saved = localStorage.getItem("theme");
  } catch {}
  if (!saved) applyTheme(event.matches ? "light" : "dark", false);
});

// ---------- Scroll progress ----------

const progressBar = document.querySelector(".scroll-progress");
const updateProgress = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
};
updateProgress();
window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress);

// ---------- Navigation ----------

const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector("#site-nav");

function setMenu(open) {
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  siteNav.classList.toggle("is-open", open);
}

menuToggle.addEventListener("click", () => {
  setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
});

siteNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

const updateHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const navLinks = [...siteNav.querySelectorAll('a[href^="#"]')];
const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    });
  },
  { rootMargin: "-45% 0px -50% 0px" },
);
navLinks
  .map((link) => document.querySelector(link.hash))
  .filter(Boolean)
  .forEach((section) => navObserver.observe(section));

document.querySelector("#year").textContent = new Date().getFullYear();

// ---------- Typing roles ----------

const roleText = document.querySelector(".role-text");
if (roleText && !prefersReducedMotion) {
  const roles = roleText.dataset.roles.split("|");
  let roleIndex = 0;
  let charIndex = roles[0].length;
  let deleting = true;

  const tick = () => {
    const role = roles[roleIndex];
    charIndex += deleting ? -1 : 1;
    roleText.textContent = role.slice(0, charIndex);

    let delay = deleting ? 40 : 80;
    if (!deleting && charIndex === role.length) {
      deleting = true;
      delay = 2200;
    } else if (deleting && charIndex === 0) {
      deleting = false;
      roleIndex = (roleIndex + 1) % roles.length;
      delay = 300;
    }
    setTimeout(tick, delay);
  };
  setTimeout(tick, 2200);
}

// ---------- 3D tilt cards ----------

if (canHover && !prefersReducedMotion) {
  document.querySelectorAll("[data-tilt]").forEach((card) => {
    const maxTilt = card.classList.contains("project-featured") ? 4 : 8;

    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.classList.add("is-tilting");
      card.style.transform =
        `perspective(1000px) rotateX(${-y * maxTilt}deg) rotateY(${x * maxTilt}deg) translateZ(6px)`;
    });

    card.addEventListener("pointerleave", () => {
      card.classList.remove("is-tilting");
      card.style.transform = "";
    });
  });
}

// ---------- 3D skill sphere ----------

const sphere = document.querySelector(".skill-sphere");
if (sphere) {
  const skills = sphere.dataset.skills.split("|");
  const tags = skills.map((skill) => {
    const tag = document.createElement("span");
    tag.className = "skill-tag";
    tag.textContent = skill;
    sphere.append(tag);
    return tag;
  });

  // Spread the tags evenly over a sphere (Fibonacci lattice).
  const points = skills.map((_, index) => {
    const y = 1 - (index / (skills.length - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = index * Math.PI * (3 - Math.sqrt(5));
    return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
  });

  let angleX = 0.3;
  let angleY = 0;
  let velocityX = 0.0015;
  let velocityY = 0.004;
  let visible = false;

  function draw() {
    const size = sphere.clientWidth / 2 - 50;
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);
    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);

    points.forEach((point, index) => {
      const x1 = point.x * cosY - point.z * sinY;
      const z1 = point.x * sinY + point.z * cosY;
      const y2 = point.y * cosX - z1 * sinX;
      const z2 = point.y * sinX + z1 * cosX;
      const depth = (z2 + 1) / 2;
      const tag = tags[index];
      tag.style.transform =
        `translate(-50%, -50%) translate3d(${x1 * size}px, ${y2 * size}px, 0) scale(${0.6 + depth * 0.6})`;
      tag.style.opacity = String(0.25 + depth * 0.75);
      tag.style.zIndex = String(Math.round(depth * 100));
    });
  }

  function spin() {
    // skills3d.js replaces this text sphere with 3D logos when WebGL is available.
    if (!visible || sphere.classList.contains("is-3d")) return;
    angleX += velocityX;
    angleY += velocityY;
    draw();
    requestAnimationFrame(spin);
  }

  sphere.addEventListener("pointermove", (event) => {
    const rect = sphere.getBoundingClientRect();
    velocityY = ((event.clientX - rect.left) / rect.width - 0.5) * 0.03;
    velocityX = -((event.clientY - rect.top) / rect.height - 0.5) * 0.03;
  });
  sphere.addEventListener("pointerleave", () => {
    velocityX = 0.0015;
    velocityY = 0.004;
  });

  draw();
  window.addEventListener("resize", draw);

  if (!prefersReducedMotion) {
    new IntersectionObserver(([entry]) => {
      const wasVisible = visible;
      visible = entry.isIntersecting;
      if (visible && !wasVisible) spin();
    }).observe(sphere);
  }
}

// ---------- Reveal on scroll ----------

if (!prefersReducedMotion) {
  const revealTargets = document.querySelectorAll(
    ".section h2, .about-copy > p, .photo-card, .timeline-item, .project-card, .skill-groups, .skill-sphere, .cert-card, .edu-card, .contact-card",
  );
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 },
  );
  revealTargets.forEach((target) => {
    target.classList.add("reveal");
    revealObserver.observe(target);
  });
}
