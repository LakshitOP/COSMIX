'use client';

import React, { useState } from 'react';
import { Dna, Copy } from 'lucide-react';
import { OrbitalObject } from '../types/orbital';

interface OrbitalFingerprintProps {
  object?: OrbitalObject;
}

export const OrbitalFingerprint: React.FC<OrbitalFingerprintProps> = ({
  object = {
    id: 'OBJ-ISS',
    name: 'ISS (ZARYA)',
    noradId: 25544,
    type: 'PAYLOAD',
    regime: 'LEO',
    altitudeKm: 418,
    inclinationDeg: 51.64,
    eccentricity: 0.00014,
    periodMin: 92.87,
    velocityKmS: 7.66,
    epoch: '2026-08-27T00:00:00Z',
    fingerprintHash: 'FPR-8821-X99',
  },
}) => {
  const [copied, setCopied] = useState(false);

  // Generate procedural SVG points derived from altitude, inclination, eccentricity
  const numPoints = 24;
  const radius = 50;
  const cx = 70;
  const cy = 70;

  const points = Array.from({ length: numPoints }).map((_, i) => {
    const angle = (i / numPoints) * Math.PI * 2;
    // Harmonic wave formula modulated by orbital parameters
    const rMod =
      radius +
      Math.sin(angle * 3 + object.inclinationDeg * 0.1) * (object.eccentricity * 50 + 6) +
      Math.cos(angle * 5) * 4;
    const x = cx + Math.cos(angle) * rMod;
    const y = cy + Math.sin(angle) * rMod;
    return `${x},${y}`;
  }).join(' ');

  const handleCopy = () => {
    navigator.clipboard.writeText(object.fingerprintHash || 'FPR-8821-X99');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full rounded-2xl bg-[#0D0F14]/80 backdrop-blur-xl border border-white/10 p-6 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#00F0FF]">
            <Dna className="w-4 h-4" />
            <span>State Vector Signature</span>
          </div>
          <h2 className="text-xl font-bold font-sans text-white mt-1">Orbital Fingerprint Badge</h2>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all"
        >
          <Copy className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span>{copied ? 'Copied Hash' : 'Copy Hash'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center my-4">
        {/* Procedural Vector Badge */}
        <div className="flex items-center justify-center p-6 bg-black/40 rounded-xl border border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#00f0ff0f_1px,transparent_1px)] [background-size:12px_12px]" />

          <svg width="140" height="140" viewBox="0 0 140 140" className="relative z-10">
            {/* Concentric baseline guides */}
            <circle cx="70" cy="70" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <circle cx="70" cy="70" r="50" fill="none" stroke="rgba(0,240,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />

            {/* Procedural Harmonic Badge Polygon */}
            <polygon
              points={points}
              fill="rgba(0, 240, 255, 0.12)"
              stroke="#00F0FF"
              strokeWidth="2"
              className="drop-shadow-[0_0_10px_rgba(0,240,255,0.5)] animate-pulse"
            />

            {/* Center Core */}
            <circle cx="70" cy="70" r="4" fill="#00F0FF" />
          </svg>
        </div>

        {/* Telemetry Breakdown */}
        <div className="flex flex-col gap-2.5 text-xs font-mono">
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-slate-400">Target Asset</span>
            <span className="text-white font-bold">{object.name}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-slate-400">NORAD ID</span>
            <span className="text-[#00F0FF]">{object.noradId}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-slate-400">Inclination / Alt</span>
            <span className="text-slate-200">{object.inclinationDeg}° · {object.altitudeKm} km</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-slate-400">Eccentricity (e)</span>
            <span className="text-slate-200">{object.eccentricity.toFixed(5)}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-400">Vector Hash</span>
            <span className="text-[#4FD1A5]">{object.fingerprintHash || 'FPR-8821-X99'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

