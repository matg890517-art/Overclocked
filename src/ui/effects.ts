interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Fx {
  burst: (x: number, y: number, color: string, count: number, speed: number) => void;
  resize: () => void;
  stop: () => void;
}

export function mountFx(canvas: HTMLCanvasElement): Fx {
  const particles: Particle[] = [];
  const ctx = canvas.getContext("2d");
  let raf = 0;

  function resize(): void {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(): void {
    raf = requestAnimationFrame(frame);
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= 1;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.vx *= 0.99;
      const alpha = p.life / p.max;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  resize();
  raf = requestAnimationFrame(frame);

  return {
    resize,
    stop: () => cancelAnimationFrame(raf),
    burst: (x, y, color, count, speed) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random());
        particles.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 24 + Math.floor(Math.random() * 20),
          max: 40,
          color,
          size: 2 + Math.random() * 3.5,
        });
      }
    },
  };
}

export function shake(el: HTMLElement, tier: number): void {
  el.classList.remove("shake-1", "shake-2", "shake-3");
  if (tier <= 0) return;
  const cls = tier >= 3 ? "shake-3" : tier >= 2 ? "shake-2" : "shake-1";
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), 480);
}

export function flash(tier: number): void {
  const node = document.getElementById("flash");
  if (!node || tier <= 0) return;
  node.dataset.tier = String(tier);
  node.classList.remove("on");
  void node.offsetWidth;
  node.classList.add("on");
}
