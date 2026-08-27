'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sliders, RotateCcw } from 'lucide-react';
import { PlaygroundConfig, OrbitalObject } from '../types/orbital';

export const AnalyticsPlayground: React.FC = () => {
  const [config, setConfig] = useState<PlaygroundConfig>({
    xAxis: 'altitudeKm',
    yAxis: 'inclinationDeg',
    sizeParam: 'velocityKmS',
    colorParam: 'type',
    regimeFilter: 'ALL',
    year: 2026,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const AXIS_OPTIONS: { key: keyof OrbitalObject; label: string; unit: string }[] = [
    { key: 'altitudeKm', label: 'Altitude', unit: 'km' },
    { key: 'inclinationDeg', label: 'Inclination', unit: '°' },
    { key: 'velocityKmS', label: 'Orbital Velocity', unit: 'km/s' },
    { key: 'eccentricity', label: 'Eccentricity', unit: 'e' },
    { key: 'periodMin', label: 'Orbital Period', unit: 'min' },
  ];

  // Draw custom dynamic scatter plot based on selected X & Y parameters
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const padding = 40;

    // Draw coordinate axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#9AA4B8';
    ctx.font = '11px "JetBrains Mono"';
    ctx.fillText(`X: ${config.xAxis}`, w - padding - 80, h - padding + 24);
    ctx.fillText(`Y: ${config.yAxis}`, padding - 30, padding - 10);

    // Procedural Scatter Points
    const numPoints = 180;
    for (let i = 0; i < numPoints; i++) {
      const xNorm = Math.random();
      const yNorm = Math.random();
      const x = padding + xNorm * (w - padding * 2);
      const y = h - padding - yNorm * (h - padding * 2);

      // Color mapping
      ctx.fillStyle = i % 5 === 0 ? '#EF6A6A' : i % 3 === 0 ? '#E8B657' : '#00F0FF';
      ctx.beginPath();
      ctx.arc(x, y, 2.5 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [config]);

  return (
    <div className="relative w-full rounded-2xl bg-[#0D0F14]/80 backdrop-blur-xl border border-white/10 p-6 overflow-hidden shadow-2xl">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-white/10 gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#00F0FF]">
            <Sliders className="w-4 h-4" />
            <span>Custom Telemetry Matrix</span>
          </div>
          <h2 className="text-xl font-bold font-sans text-white mt-1">Analytics Playground (Visual Query Builder)</h2>
        </div>
        <button
          onClick={() => setConfig({ xAxis: 'altitudeKm', yAxis: 'inclinationDeg', sizeParam: 'velocityKmS', colorParam: 'type', regimeFilter: 'ALL', year: 2026 })}
          className="flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-white"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Axes</span>
        </button>
      </div>

      {/* Parameter Selection Controls Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        <div>
          <label className="text-[10px] font-mono text-slate-400 uppercase">X-Axis Mapping</label>
          <select
            value={config.xAxis}
            onChange={(e) => setConfig({ ...config, xAxis: e.target.value as keyof OrbitalObject })}
            className="w-full mt-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-[#00F0FF] outline-none"
          >
            {AXIS_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key} className="bg-[#0D0F14]">
                {opt.label} ({opt.unit})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono text-slate-400 uppercase">Y-Axis Mapping</label>
          <select
            value={config.yAxis}
            onChange={(e) => setConfig({ ...config, yAxis: e.target.value as keyof OrbitalObject })}
            className="w-full mt-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-[#00F0FF] outline-none"
          >
            {AXIS_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key} className="bg-[#0D0F14]">
                {opt.label} ({opt.unit})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono text-slate-400 uppercase">Point Radius Size</label>
          <select
            value={config.sizeParam}
            onChange={(e) => setConfig({ ...config, sizeParam: e.target.value as keyof OrbitalObject })}
            className="w-full mt-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-[#00F0FF] outline-none"
          >
            {AXIS_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key} className="bg-[#0D0F14]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono text-slate-400 uppercase">Domain Filter</label>
          <select
            value={config.regimeFilter}
            onChange={(e) => setConfig({ ...config, regimeFilter: e.target.value as any })}
            className="w-full mt-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-[#00F0FF] outline-none"
          >
            <option value="ALL" className="bg-[#0D0F14]">All Regimes (LEO/MEO/GEO)</option>
            <option value="LEO" className="bg-[#0D0F14]">Low Earth Orbit (LEO)</option>
            <option value="MEO" className="bg-[#0D0F14]">Medium Earth Orbit (MEO)</option>
            <option value="GEO" className="bg-[#0D0F14]">Geostationary (GEO)</option>
          </select>
        </div>
      </div>

      {/* Dynamic Scatter Matrix Canvas */}
      <div className="relative w-full h-[320px] rounded-xl bg-black/40 border border-white/5 overflow-hidden">
        <canvas ref={canvasRef} width={800} height={320} className="w-full h-full object-contain" />
      </div>
    </div>
  );
};

