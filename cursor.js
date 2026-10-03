const rocket = document.getElementById("rocket-cursor");
const finePointer = window.matchMedia("(pointer: fine)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (rocket && finePointer && !reduceMotion) {
  document.documentElement.classList.add("has-rocket");

  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  let placed = false;

  window.addEventListener("mousemove", (event) => {
    tx = event.clientX;
    ty = event.clientY;
    if (!placed) {
      x = tx;
      y = ty;
      placed = true;
      rocket.hidden = false;
    }
  });

  document.documentElement.addEventListener("mouseleave", () => {
    rocket.hidden = true;
    placed = false;
    vx = 0;
    vy = 0;
  });

  function frame() {
    if (placed) {
      const dx = tx - x;
      const dy = ty - y;
      const dist = Math.hypot(dx, dy);
      const accel = 0.08 + Math.min(0.55, dist / 280);
      vx = (vx + dx * accel) * 0.72;
      vy = (vy + dy * accel) * 0.72;
      x += vx;
      y += vy;

      const speed = Math.hypot(vx, vy);
      const burn = Math.min(1, Math.max(0, (speed - 1.6) / 16));
      const angle = speed > 0.35 ? Math.atan2(vy, vx) : Math.atan2(ty - y, tx - x);
      rocket.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
      rocket.style.setProperty("--burn", burn.toFixed(3));
      rocket.classList.toggle("is-burning", burn > 0.04);
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
