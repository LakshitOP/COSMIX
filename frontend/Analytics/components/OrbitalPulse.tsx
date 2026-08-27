'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Activity, AlertTriangle, Rocket, RefreshCw, Zap } from 'lucide-react';
import { CatalogEvent } from '../types/orbital';

export const OrbitalPulse: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<CatalogEvent | null>(null);
  const [scrubberTime, setScrubberTime] = useState<number>(100);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const MOCK_PULSE_EVENTS: CatalogEvent[] = [
    {
      id: 'EV-1',
      timestamp: 25,
      type: 'LAUNCH',
      severity: 'NOMINAL',
      primaryObject: 'FALCON 9 (STARLINK G10-5)',
      label: 'Payload Deployment: 22 Spacecraft into 530km LEO',
    },
    {
      id: 'EV-2',
      timestamp: 48,
      type: 'CLOSE_APPROACH',
      severity: 'CRITICAL',
      primaryObject: 'STARLINK-3112',
      secondaryObject: 'COSMOS 2251 DEBRIS',
      missDistanceKm: 4.2,
      relVelocityKmS: 14.7,
      label: 'Conjunction Screening: Miss vector 4.2 km @ 18:42 UTC',
    },
    {
      id: 'EV-3',
      timestamp: 75,
      type: 'MANEUVER',
      severity: 'NOMINAL',
      primaryObject: 'SENTINEL-6A',
      label: 'Orbital Trim Burn: +0.08 m/s Delta-V Execution Verified',
    },
    {
      id: 'EV-4',
      timestamp: 90,
      type: 'FRAGMENTATION',
      severity: 'WARNING',
      primaryObject: 'CZ-4C R/B',
      label: 'Debris Track: Minor fragmentation event cataloged (12 fragments)',
    },
  ];

  // Draw Live Pulse EKG Waveform with spikes at event timestamps
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const cy = h / 2;

      // Base Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Draw EKG Pulse Waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00F0FF';
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 10;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const t = (x + offset) * 0.04;
        let y = cy + Math.sin(t) * 8;

        // Add heartbeat spikes near event markers
        MOCK_PULSE_EVENTS.forEach((ev) => {
          const eventX = (ev.timestamp / 100) * w;
          const dist = Math.abs(x - eventX);
          if (dist < 20) {
            const spike = Math.cos((dist / 20) * Math.PI) * (ev.severity === 'CRITICAL' ? 45 : 25);
            y += (x % 4 === 0 ? -spike : spike * 0.5);
          }
        });

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      offset += 1;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative w-full rounded-2xl bg-[#0D0F14]/80 backdrop-blur-xl border border-white/10 p-6 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#00F0FF]">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>Telemetry Rhythm</span>
          </div>
          <h2 className="text-xl font-bold font-sans text-white mt-1">Orbital Pulse (Event Waveform)</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-[#4FD1A5] animate-ping" />
          <span>Real-time Ingestion Stream</span>
        </div>
      </div>

      {/* Waveform Canvas with Event Marker Pins */}
      <div className="relative w-full h-[180px] my-5 rounded-xl bg-black/40 border border-white/5 overflow-hidden">
        <canvas ref={canvasRef} width={800} height={180} className="w-full h-full" />

        {/* Interactive Event Pins on Waveform */}
        {MOCK_PULSE_EVENTS.map((ev) => (
          <div
            key={ev.id}
            style={{ left: `${ev.timestamp}%` }}
            onClick={() => setSelectedEvent(ev)}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer group"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs shadow-lg transition-transform group-hover:scale-125 ${
                ev.severity === 'CRITICAL'
                  ? 'bg-[#EF6A6A]/20 border-[#EF6A6A] text-[#EF6A6A] shadow-[0_0_12px_rgba(239,106,106,0.6)]'
                  : ev.severity === 'WARNING'
                  ? 'bg-[#E8B657]/20 border-[#E8B657] text-[#E8B657]'
                  : 'bg-[#00F0FF]/20 border-[#00F0FF] text-[#00F0FF]'
              }`}
            >
              {ev.type === 'LAUNCH' && <Rocket className="w-3 h-3" />}
              {ev.type === 'CLOSE_APPROACH' && <AlertTriangle className="w-3 h-3" />}
              {ev.type === 'MANEUVER' && <RefreshCw className="w-3 h-3" />}
              {ev.type === 'FRAGMENTATION' && <Zap className="w-3 h-3" />}
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#0D0F14]/95 backdrop-blur-md border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
              <span className="text-white font-bold">{ev.primaryObject}</span>
              <div className="text-slate-400 text-[10px]">{ev.type}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Historical Scrubber Range */}
      <div className="flex items-center gap-3 pt-2">
        <span className="text-[11px] font-mono text-slate-400">HISTORICAL HORIZON:</span>
        <input
          type="range"
          min="10"
          max="100"
          value={scrubberTime}
          onChange={(e) => setScrubberTime(Number(e.target.value))}
          className="flex-1 accent-[#00F0FF] h-1.5 bg-white/10 rounded-lg cursor-pointer"
        />
        <span className="text-xs font-mono text-[#00F0FF] font-bold">T-{Math.round((100 - scrubberTime) * 0.48)}h</span>
      </div>

      {/* Selected Event Telemetry Drawer */}
      {selectedEvent && (
        <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-start justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider">EVENT INSPECTION</span>
            <div className="text-sm font-bold text-white mt-0.5">{selectedEvent.label}</div>
            <div className="text-xs text-slate-400 font-mono mt-1">
              Object: {selectedEvent.primaryObject} {selectedEvent.secondaryObject ? `↔ ${selectedEvent.secondaryObject}` : ''}
            </div>
          </div>
          <button onClick={() => setSelectedEvent(null)} className="text-xs text-slate-500 hover:text-white">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

