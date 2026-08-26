'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AskTheDataBar } from './AskTheDataBar';
import { OrbitalMicroscope } from './OrbitalMicroscope';
import { OrbitalPulse } from './OrbitalPulse';
import { ThenVsNowSlider } from './ThenVsNowSlider';
import { OrbitalFingerprint } from './OrbitalFingerprint';
import { AnalyticsPlayground } from './AnalyticsPlayground';

export const OrbitalAnalyticsDashboard: React.FC = () => {
  const [activeQueryFeedback, setActiveQueryFeedback] = useState<string | null>(null);

  const handleQuery = (query: string, parsed: any) => {
    setActiveQueryFeedback(`Visualizer dynamically filtered by: "${query}"`);
    setTimeout(() => setActiveQueryFeedback(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#050608] text-slate-100 font-sans selection:bg-[#00F0FF]/20 selection:text-white relative overflow-x-hidden">
      {/* Background Sub-1px Gridlines & Ambient Glow */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00F0FF]/5 blur-[140px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 z-10 flex flex-col gap-10">
        
        {/* Natural Language Ask the Data Bar */}
        <section>
          <AskTheDataBar onQueryExecute={handleQuery} />
          {activeQueryFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-xs font-mono text-[#00F0FF] mt-2"
            >
              {activeQueryFeedback}
            </motion.div>
          )}
        </section>

        {/* Feature 1: Orbital Microscope (Multi-Scale Spatial Engine) */}
        <section>
          <OrbitalMicroscope />
        </section>

        {/* Feature 2: Orbital Pulse (Real-time Event Waveform) */}
        <section>
          <OrbitalPulse />
        </section>

        {/* Feature 3: Then vs. Now Density Split Slider */}
        <section>
          <ThenVsNowSlider />
        </section>

        {/* Feature 4 & 5 Grid: Orbital Fingerprint & Analytics Playground */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <OrbitalFingerprint />
          <AnalyticsPlayground />
        </section>

      </main>
    </div>
  );
};
export default OrbitalAnalyticsDashboard;

