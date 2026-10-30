import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
};

const COLORS = ["#85C1B6", "#85C1B6", "#2B8272", "#B1D258"];
const LINK_DIST = 140;
const MOUSE_DIST = 190;

export default function MoleculeField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: -9999, y: -9999 };
    let w = 0;
    let h = 0;
    let nodes: Node[] = [];
    let raf = 0;
    let start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(120, Math.round((w * h) / 11000));
      nodes = Array.from({ length: count }, () => {
        // start at the centre-left and burst outwards on load
        const a = Math.random() * Math.PI * 2;
        const s = 6 + Math.random() * 14;
        return {
          x: w * 0.6,
          y: h * 0.5,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          r: 1.5 + Math.random() * 2.5,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        };
      });
      if (reduce) {
        nodes.forEach((n) => {
          n.x = Math.random() * w;
          n.y = Math.random() * h;
          n.vx = n.vy = 0;
        });
      }
      start = performance.now();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const age = (performance.now() - start) / 1000;
      // after the burst, calm down into a gentle drift
      const damp = age < 1.4 ? 0.955 : 0.99;

      for (const n of nodes) {
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < MOUSE_DIST && d > 0.1) {
          const f = (1 - d / MOUSE_DIST) * 0.9;
          n.vx += (dx / d) * f * 0.35;
          n.vy += (dy / d) * f * 0.35;
        }
        n.vx *= damp;
        n.vy *= damp;
        // keep a minimum drift so it never fully freezes
        if (age > 1.4 && Math.hypot(n.vx, n.vy) < 0.15) {
          n.vx += (Math.random() - 0.5) * 0.05;
          n.vy += (Math.random() - 0.5) * 0.05;
        }
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.x = Math.max(0, Math.min(w, n.x));
        n.y = Math.max(0, Math.min(h, n.y));
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK_DIST) {
            ctx.strokeStyle = `rgba(133,193,182,${(1 - d / LINK_DIST) * 0.35})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // bonds to the cursor
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < MOUSE_DIST + 40) {
          ctx.strokeStyle = `rgba(177,210,88,${(1 - md / (MOUSE_DIST + 40)) * 0.7})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        ctx.fillStyle = n.color;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      if (!reduce) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="absolute inset-y-0 right-0 h-full w-full md:w-3/5"
    />
  );
}
