'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeftRight, Clock } from 'lucide-react';

export const ThenVsNowSlider: React.FC = () => {
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage (0 to 100)
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasLeftRef = useRef<HTMLCanvasElement>(null);
  const canvasRightRef = useRef<HTMLCanvasElement>(null);

  const handlePointerDown = () => { isDragging.current = true; };
  const handlePointerUp = () => { isDragging.current = false; };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    setSliderPos((x / rect.width) * 100);
  };

  // Draw 2020 (moderate density) vs 2026 (high constellation density)
  useEffect(() => {
    const drawSide = (canvas: HTMLCanvasElement | null, count: number, isModern: boolean) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw Earth
      ctx.fillStyle = '#101624';
      ctx.beginPath();
      ctx.arc(cx, cy, 70, 0, Math.PI * 2);
      ctx.fill();

      // Draw Particles
      for (let i = 0; i < count; i++) {
        const alt = 80 + Math.random() * (isModern ? 120 : 90);
        const angle = Math.random() * Math.PI * 2;
        const x = cx + Math.cos(angle) * alt;
        const y = cy + Math.sin(angle) * alt * 0.55;

        ctx.fillStyle = isModern && i % 3 === 0 ? '#00F0FF' : 'rgba(158, 176, 204, 0.6)';
        ctx.beginPath();
        ctx.arc(x, y, isModern ? 1.8 : 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawSide(canvasLeftRef.current, 240, false); // 2020: ~5,200 objects
    drawSide(canvasRightRef.current, 680, true);  // 2026: ~12,482 objects
  }, []);

  return (
    <div className="relative w-full rounded-2xl bg-[#0D0F14]/80 backdrop-blur-xl border border-white/10 p-6 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#00F0FF]">
            <Clock className="w-4 h-4" />
            <span>Temporal Delta Engine</span>
          </div>
          <h2 className="text-xl font-bold font-sans text-white mt-1">Then vs. Now Density Split</h2>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-400">2020 (5,200 Objs)</span>
          <ArrowLeftRight className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span className="text-[#00F0FF] font-bold">2026 (12,482 Objs)</span>
        </div>
      </div>

      {/* Split Screen Container */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative w-full h-[360px] my-5 rounded-xl bg-black/50 border border-white/5 overflow-hidden select-none cursor-ew-resize"
      >
        {/* Right Canvas (2026 Modern) */}
        <canvas ref={canvasRightRef} width={800} height={360} className="absolute inset-0 w-full h-full object-contain" />
        <div className="absolute top-4 right-4 bg-[#0D0F14]/90 backdrop-blur-md border border-[#00F0FF]/30 px-3 py-1.5 rounded-lg text-xs font-mono text-[#00F0FF]">
          2026 · +140% LEO MEGA-CONSTELLATIONS
        </div>

        {/* Left Canvas (2020 Historic) with CSS Clip-path */}
        <div
          style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
          className="absolute inset-0 w-full h-full bg-[#050608]"
        >
          <canvas ref={canvasLeftRef} width={800} height={360} className="w-full h-full object-contain" />
          <div className="absolute top-4 left-4 bg-[#0D0F14]/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
            2020 · PRE-CONSTELLATION BASELINE
          </div>
        </div>

        {/* Divider Handle */}
        <div
          style={{ left: `${sliderPos}%` }}
          onPointerDown={handlePointerDown}
          className="absolute top-0 bottom-0 w-1 bg-[#00F0FF] shadow-[0_0_15px_#00F0FF] -translate-x-1/2 flex items-center justify-center z-10"
        >
          <div className="w-8 h-8 rounded-full bg-[#0D0F14] border-2 border-[#00F0FF] text-[#00F0FF] flex items-center justify-center shadow-2xl">
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};

