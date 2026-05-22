"use client";

import { useRef, useEffect, useState } from "react";

interface WaveBlobProps {
  speaking?: boolean;
  width?:    number;
  height?:   number;
  accentHue?: number;
}

export function WaveBlob({
  speaking   = false,
  width      = 320,
  height     = 120,
  accentHue  = 268,
}: WaveBlobProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const ampRef      = useRef(0);
  const barsRef     = useRef<{ target: number; cur: number; phase: number }[]>([]);
  const samplesRef  = useRef<number[]>([]);
  const [glow, setGlow] = useState(0);

  const BAR_GAP   = 8;
  const BAR_WIDTH = 3;
  const N         = Math.max(24, Math.floor(width / (BAR_GAP + BAR_WIDTH)));

  // Amplitude follower
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const baseline = 0.08 + 0.03 * Math.sin(t * 1.3);
      const voice = speaking
        ? (0.50
          + 0.22 * Math.sin(t * 4.8)
          + 0.14 * Math.sin(t * 9.1 + 0.7)
          + 0.10 * Math.sin(t * 17.1 + 1.4)
          + 0.06 * Math.sin(t * 31.1))
        : 0;
      const target = Math.max(baseline, Math.min(1.05, voice));
      const cur = ampRef.current;
      ampRef.current = cur + (target - cur) * (target > cur ? 0.30 : 0.06);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  // Init bar state
  useEffect(() => {
    let seed = 53;
    const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    barsRef.current = Array.from({ length: N }, () => ({
      target: 0, cur: 0, phase: rng() * Math.PI * 2,
    }));
    samplesRef.current = new Array(N).fill(0);
  }, [N]);

  // Canvas draw loop
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width  = width  * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);

    let raf: number;
    const t0 = performance.now();

    function roundedBar(x: number, y: number, w: number, h: number, r: number) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
      ctx.fill();
    }

    const draw = () => {
      const t   = (performance.now() - t0) / 1000;
      const amp = ampRef.current;
      const samples = samplesRef.current;

      samples.unshift(amp * (0.85 + 0.10 * Math.sin(t * 21.7) + 0.08 * Math.sin(t * 33.3 + 1.2)));
      if (samples.length > N) samples.length = N;

      const bars = barsRef.current;
      for (let i = 0; i < N; i++) {
        const bar  = bars[i];
        if (!bar) continue;
        const edge   = Math.sin((i / (N - 1)) * Math.PI);
        const env    = samples[i] ?? 0;
        const micro  = 0.5 + 0.5 * Math.sin(t * 3.5 + bar.phase + i * 0.25);
        const target = Math.pow(edge, 0.6) * env * (0.45 + 0.55 * micro);
        bar.target = target;
        const cur = bar.cur;
        bar.cur = cur + (target - cur) * (target > cur ? 0.35 : 0.10);
      }

      ctx.clearRect(0, 0, width, height);

      const cy   = height / 2;
      const stride = width / (N - 1);
      const minH = 4;
      const maxH = height * 0.78;
      const radius = BAR_WIDTH / 2;

      ctx.strokeStyle = `hsla(${accentHue}, 70%, 60%, 0.06)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();

      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < N; i++) {
        const b = bars[i];
        if (!b) continue;
        const x = i * stride;
        const h = Math.max(minH, minH + b.cur * (maxH - minH));
        const centerW = 1 - Math.abs((i / (N - 1)) - 0.5) * 2;
        const lite = 62 + centerW * 18;

        const grad = ctx.createLinearGradient(x, cy - h / 2, x, cy + h / 2);
        grad.addColorStop(0,   `hsla(${accentHue}, 95%, ${lite + 8}%, 0.95)`);
        grad.addColorStop(0.5, `hsla(${accentHue}, 100%, ${lite + 15}%, 1.0)`);
        grad.addColorStop(1,   `hsla(${accentHue}, 95%, ${lite + 8}%, 0.95)`);

        ctx.fillStyle = `hsla(${accentHue}, 90%, ${lite}%, ${0.18 + b.cur * 0.20})`;
        ctx.shadowBlur = 16;
        ctx.shadowColor = `hsl(${accentHue}, 95%, ${lite}%)`;
        roundedBar(x - BAR_WIDTH / 2 - 1, cy - h / 2 - 1, BAR_WIDTH + 2, h + 2, radius + 1);

        ctx.fillStyle = grad;
        ctx.shadowBlur = 4;
        ctx.shadowColor = `hsl(${accentHue}, 100%, 78%)`;
        roundedBar(x - BAR_WIDTH / 2, cy - h / 2, BAR_WIDTH, h, radius);
      }

      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [width, height, accentHue, N]);

  // Glow follower
  useEffect(() => {
    let raf: number;
    const tick = () => { setGlow(ampRef.current); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ position: "relative", width, height, display: "grid", placeItems: "center" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at center, hsla(${accentHue}, 85%, 50%, ${0.12 + glow * 0.18}) 0%, transparent 65%)`,
        filter: "blur(28px)", opacity: 0.9, pointerEvents: "none",
        transition: "opacity .15s linear",
      }} />
      <canvas
        ref={canvasRef}
        style={{ width, height, display: "block", position: "relative" }}
      />
    </div>
  );
}
