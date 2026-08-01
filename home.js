(() => {
  "use strict";

  const heroBg = document.getElementById("heroBg");
  const particles = document.getElementById("homeParticles");

  if (particles) {
    const count = window.innerWidth < 700 ? 14 : 24;
    for (let index = 0; index < count; index += 1) {
      const span = document.createElement("span");
      const size = 2 + Math.random() * 5;
      const duration = 7 + Math.random() * 9;
      const delay = -Math.random() * duration;
      const sway = (Math.random() - 0.5) * 160;
      span.style.left = `${Math.random() * 100}%`;
      span.style.width = `${size}px`;
      span.style.height = `${size}px`;
      span.style.setProperty("--sway", `${sway.toFixed(1)}px`);
      span.style.animationDuration = `${duration.toFixed(2)}s`;
      span.style.animationDelay = `${delay.toFixed(2)}s`;
      particles.appendChild(span);
    }
  }

  let ticking = false;
  window.addEventListener("mousemove", (event) => {
    if (ticking || !heroBg) {
      return;
    }
    ticking = true;
    window.requestAnimationFrame(() => {
      const x = (event.clientX / window.innerWidth - 0.5) * 22;
      const y = (event.clientY / window.innerHeight - 0.5) * 14;
      heroBg.style.setProperty("--px", `${x.toFixed(2)}px`);
      heroBg.style.setProperty("--py", `${y.toFixed(2)}px`);
      ticking = false;
    });
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
})();