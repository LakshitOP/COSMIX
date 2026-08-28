'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, Compass, Radio } from 'lucide-react';
import { ZoomLevel } from '../types/orbital';

export const OrbitalMicroscope: React.FC = () => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('EARTH');
  const [selectedSatellite] = useState<string>('ISS (ZARYA)');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const ZOOM_STAGES: { level: ZoomLevel; label: string; scale: string; desc: string }[] = [
    { level: 'EARTH', label: '1. Global Geosphere', scale: '1:100,000,000', desc: 'Full planetary overview and orbital shells.' },
    { level: 'REGIME', label: '2. LEO Space Domain', scale: '1:20,000,000', desc: 'Low Earth Orbit macro-trajectories.' },
    { level: 'ALTITUDE_BAND', label: '3. Altitude Shell (550km)', scale: '1:5,000,000', desc: 'Dense Starlink & Cosmos orbital cluster band.' },
    { level: 'NEIGHBORHOOD', label: '4. Proximity Radius (25km)', scale: '1:500,000', desc: 'Neighboring satellites & relative velocity vectors.' },
    { level: 'SATELLITE', label: '5. Single Spacecraft Telemetry', scale: '1:5,000', desc: 'Precision Keplerian elements & attitude orientation.' },
  ];

  const currentStageIndex = ZOOM_STAGES.findIndex((s) => s.level === zoomLevel);

  const handleNextZoom = () => {
    if (currentStageIndex < ZOOM_STAGES.length - 1) {
      setZoomLevel(ZOOM_STAGES[currentStageIndex + 1].level);
    }
  };

  const handlePrevZoom = () => {
    if (currentStageIndex > 0) {
      setZoomLevel(ZOOM_STAGES[currentStageIndex - 1].level);
    }
  };

  // Canvas WebGL/2D procedural rendering according to zoomLevel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw Grid / Reticle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
      ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
      ctx.stroke();

      if (zoomLevel === 'EARTH') {
        // Macro Earth + Rings
        ctx.fillStyle = '#101624';
        ctx.beginPath();
        ctx.arc(cx, cy, 90, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 140, 60, -0.2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(232, 182, 87, 0.3)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 180, 80, 0.3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (zoomLevel === 'REGIME' || zoomLevel === 'ALTITUDE_BAND') {
        // Segmented Band visualization
        ctx.strokeStyle = '#00F0FF';
        ctx.setLineDash([2, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 120, 0, Math.PI * 2);
        ctx.stroke();

        // Moving swarm dots
        for (let i = 0; i < 40; i++) {
          const a = angle * 0.5 + (i * Math.PI * 2) / 40;
          const r = 120 + ((i % 5) - 2) * 8;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r * 0.45;

          ctx.fillStyle = i % 7 === 0 ? '#EF6A6A' : '#00F0FF';
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (zoomLevel === 'NEIGHBORHOOD' || zoomLevel === 'SATELLITE') {
        // High magnification neighborhood graph
        ctx.fillStyle = '#00F0FF';
        ctx.shadowColor = '#00F0FF';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Proximity connections
        const neighbors = [
          { name: 'DEB-34182', dist: '4.2 km', dx: -80, dy: -60, color: '#EF6A6A' },
          { name: 'STARLINK-3112', dist: '8.4 km', dx: 110, dy: -40, color: '#00F0FF' },
          { name: 'CZ-4C DEB', dist: '13.2 km', dx: -50, dy: 90, color: '#E8B657' },
        ];

        neighbors.forEach((nb) => {
          const nx = cx + nb.dx;
          const ny = cy + nb.dy;

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(nx, ny);
          ctx.stroke();

          ctx.fillStyle = nb.color;
          ctx.beginPath();
          ctx.arc(nx, ny, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#9AA4B8';
          ctx.font = '10px "JetBrains Mono"';
          ctx.fillText(`${nb.name} (${nb.dist})`, nx + 8, ny + 3);
        });
      }

      angle += 0.02;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [zoomLevel]);

  return (
    <div className="relative w-full rounded-2xl bg-[#0D0F14]/80 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl p-6">
      {/* Top Header & Stage Stepper */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#00F0FF]">
            <Compass className="w-4 h-4 animate-spin-slow" />
            <span>Multi-Scale Spatial Engine</span>
          </div>
          <h2 className="text-xl font-bold font-sans text-white mt-1">Orbital Microscope</h2>
        </div>

        {/* Stepper Breadcrumbs */}
        <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5">
          {ZOOM_STAGES.map((s, idx) => (
            <button
              key={s.level}
              onClick={() => setZoomLevel(s.level)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                zoomLevel === s.level
                  ? 'bg-[#00F0FF] text-[#050608] font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas & HUD Overlay */}
      <div className="relative w-full h-[420px] my-4 rounded-xl bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center">
        {/* Sub-1px HUD Grid & Scanlines */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <canvas ref={canvasRef} width={800} height={420} className="w-full h-full object-contain" />

        {/* Micro-HUD Scale Badge */}
        <div className="absolute top-4 left-4 bg-[#0D0F14]/90 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 text-xs font-mono">
          <div className="text-slate-400 text-[10px]">MAGNIFICATION SCALE</div>
          <div className="text-[#00F0FF] font-bold">{ZOOM_STAGES[currentStageIndex].scale}</div>
          <div className="text-slate-300 text-[11px] mt-1">{ZOOM_STAGES[currentStageIndex].label}</div>
        </div>

        {/* Telemetry Target Info */}
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto bg-[#0D0F14]/90 backdrop-blur-md border border-white/10 rounded-xl p-3.5 text-xs">
          <div className="flex items-center gap-2 font-mono text-[#4FD1A5] text-[11px]">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>FOCUSED ORBITAL NODE: {selectedSatellite}</span>
          </div>
          <p className="text-slate-400 text-xs mt-1 max-w-sm">{ZOOM_STAGES[currentStageIndex].desc}</p>
        </div>

        {/* Floating Zoom Action Controls */}
        <div className="absolute right-4 bottom-4 flex flex-col gap-2">
          <button
            onClick={handleNextZoom}
            disabled={currentStageIndex === ZOOM_STAGES.length - 1}
            className="p-3 bg-[#0D0F14]/90 hover:bg-[#00F0FF] hover:text-[#050608] text-white border border-white/10 rounded-xl transition-all disabled:opacity-30 flex items-center justify-center shadow-lg"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handlePrevZoom}
            disabled={currentStageIndex === 0}
            className="p-3 bg-[#0D0F14]/90 hover:bg-[#00F0FF] hover:text-[#050608] text-white border border-white/10 rounded-xl transition-all disabled:opacity-30 flex items-center justify-center shadow-lg"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

