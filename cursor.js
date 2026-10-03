const rocket = document.getElementById("rocket-cursor");
const finePointer = window.matchMedia("(pointer: fine)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function wrapAngle(delta) {
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

if (rocket && finePointer && !reduceMotion) {
  document.documentElement.classList.add("has-rocket");

  const CLEARANCE = 150;

  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let heading = 0;
  let omega = 0;
  let speed = 0;
  let burn = 0;
  let placed = false;
  let inside = false;
  let mode = "away";
  let exitEdge = "left";
  let lastMoveAt = 0;

  function nearestEdge(px, py) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const edges = [
      ["left", px],
      ["right", w - px],
      ["top", py],
      ["bottom", h - py],
    ];
    edges.sort((a, b) => a[1] - b[1]);
    return edges[0][0];
  }

  function beyondEdge(edge, px, py, distance) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (edge === "left") return { x: -distance, y: clamp(py, 0, h) };
    if (edge === "right") return { x: w + distance, y: clamp(py, 0, h) };
    if (edge === "top") return { x: clamp(px, 0, w), y: -distance };
    return { x: clamp(px, 0, w), y: h + distance };
  }

  function offscreen(px, py) {
    return (
      px < -8 ||
      py < -8 ||
      px > window.innerWidth + 8 ||
      py > window.innerHeight + 8
    );
  }

  function clearOfScreen(px, py, angle) {
    const tailX = px - Math.cos(angle) * 110;
    const tailY = py - Math.sin(angle) * 110;
    return offscreen(px, py) && offscreen(tailX, tailY);
  }

  function show() {
    placed = true;
    rocket.hidden = false;
  }

  function enterFrom(px, py) {
    const edge = nearestEdge(px, py);
    const gate = beyondEdge(edge, px, py, 28);
    const stillOnScreen = placed && !offscreen(x, y);
    const aligned =
      placed &&
      exitEdge === edge &&
      Math.hypot(x - gate.x, y - gate.y) < 220;
    if (!stillOnScreen && !aligned) {
      x = gate.x;
      y = gate.y;
      heading = Math.atan2(py - y, px - x);
      omega = 0;
      speed = 2.4;
    }
    exitEdge = edge;
    show();
    mode = "live";
  }

  function parkOffscreen(px, py) {
    inside = false;
    const edge = nearestEdge(px, py);
    const spot = beyondEdge(edge, px, py, CLEARANCE);
    exitEdge = edge;
    tx = spot.x;
    ty = spot.y;
    mode = "leaving";
    lastMoveAt = performance.now();
  }

  window.addEventListener("mousemove", (event) => {
    tx = event.clientX;
    ty = event.clientY;
    lastMoveAt = performance.now();
    if (!inside) {
      inside = true;
      enterFrom(tx, ty);
    }
  });

  document.documentElement.addEventListener("mouseleave", (event) => {
    if (!placed || !inside) return;
    parkOffscreen(event.clientX, event.clientY);
  });

  document.addEventListener("mouseout", (event) => {
    if (event.relatedTarget || event.toElement) return;
    if (!placed || !inside) return;
    parkOffscreen(event.clientX, event.clientY);
  });

  function step(idleAmount, leaving) {
    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.hypot(dx, dy);
    const desired = dist > 6 ? Math.atan2(dy, dx) : heading;
    const delta = wrapAngle(desired - heading);
    const steer = Math.max(-1.15, Math.min(1.15, delta));
    const close = dist < 72 ? 1 : dist < 160 ? (160 - dist) / 88 : 0;
    const brake = leaving ? 0 : idleAmount * (0.25 + 0.75 * close);
    const turnBoost = leaving ? 0 : 0.11 * (1 - brake);

    omega = omega * (0.94 - 0.05 * brake) + steer * 0.0032 * (1 - 0.35 * brake);
    heading += omega;

    const turning = Math.min(1, Math.abs(omega) / 0.03);
    const cruise = dist < 14 ? 0 : Math.min(6, (dist - 14) * 0.028);
    speed =
      speed * (0.965 - 0.03 * brake) +
      cruise * 0.05 * (leaving ? 1 : 1 - 0.92 * brake) +
      turning * turnBoost;

    if (!leaving && brake > 0.35 && dist < 28) speed *= 1 - 0.12 * brake;
    if (leaving && dist < 48) speed *= 0.9;

    x += Math.cos(heading) * speed;
    y += Math.sin(heading) * speed;

    if (!leaving && brake > 0.7 && dist < 96 && speed < 1.4) {
      const pull = 0.05 * brake;
      x += (tx - x) * pull;
      y += (ty - y) * pull;
      speed *= 0.9;
      if (dist < 3 && speed < 0.08) {
        x = tx;
        y = ty;
        speed = 0;
        omega = 0;
      }
    }

    return dist;
  }

  function paint() {
    const targetBurn = Math.min(1, Math.max(0, (speed - 0.55) / 3.8));
    burn += (targetBurn - burn) * (targetBurn > burn ? 0.05 : 0.08);
    rocket.style.transform = `translate(${x}px, ${y}px) rotate(${heading}rad)`;
    rocket.style.setProperty("--burn", burn.toFixed(3));
    rocket.classList.toggle("is-burning", burn > 0.08);
  }

  function frame(now) {
    if (mode === "live" || mode === "leaving") {
      const idleAmount =
        mode === "live" ? clamp((now - lastMoveAt - 40) / 140, 0, 1) : 0;
      const dist = step(idleAmount, mode === "leaving");
      if (
        mode === "leaving" &&
        clearOfScreen(x, y, heading) &&
        (dist < 70 || speed < 0.35)
      ) {
        mode = "parked";
        speed = 0;
        omega = 0;
      }
      paint();
    } else if (mode === "parked" && burn > 0.01) {
      speed = 0;
      paint();
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
