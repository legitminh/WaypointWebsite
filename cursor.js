const rocket = document.getElementById("rocket-cursor");
const finePointer = window.matchMedia("(pointer: fine)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function wrapAngle(delta) {
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

if (rocket && finePointer && !reduceMotion) {
  document.documentElement.classList.add("has-rocket");

  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let heading = 0;
  let omega = 0;
  let speed = 0;
  let burn = 0;
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
    omega = 0;
    speed = 0;
    burn = 0;
  });

  function frame() {
    if (placed) {
      const dx = tx - x;
      const dy = ty - y;
      const dist = Math.hypot(dx, dy);
      const desired = dist > 6 ? Math.atan2(dy, dx) : heading;
      const delta = wrapAngle(desired - heading);
      const steer = Math.max(-1.15, Math.min(1.15, delta));
      omega = omega * 0.94 + steer * 0.0032;
      heading += omega;

      const turning = Math.min(1, Math.abs(omega) / 0.03);
      const cruise = dist < 14 ? 0 : Math.min(6, (dist - 14) * 0.028);
      speed = speed * 0.965 + cruise * 0.05 + turning * 0.11;
      x += Math.cos(heading) * speed;
      y += Math.sin(heading) * speed;

      const targetBurn = Math.min(1, Math.max(0, (speed - 0.55) / 3.8));
      burn += (targetBurn - burn) * (targetBurn > burn ? 0.05 : 0.08);

      rocket.style.transform = `translate(${x}px, ${y}px) rotate(${heading}rad)`;
      rocket.style.setProperty("--burn", burn.toFixed(3));
      rocket.classList.toggle("is-burning", burn > 0.08);
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
