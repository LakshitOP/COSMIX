'use client';

import React, { useState } from 'react';
import { Sparkles, Command, ArrowRight } from 'lucide-react';

interface AskTheDataBarProps {
  onQueryExecute: (query: string, parsedFilter: any) => void;
}

export const AskTheDataBar: React.FC<AskTheDataBarProps> = ({ onQueryExecute }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);

  const SUGGESTED_QUERIES = [
    { label: 'Debris clusters above 800km', filter: { type: 'DEBRIS', minAlt: 800 } },
    { label: 'Starlink conjunctions < 5km', filter: { name: 'STARLINK', maxMiss: 5 } },
    { label: 'LEO vs GEO density ratio', filter: { compare: ['LEO', 'GEO'] } },
    { label: 'High eccentricity payloads', filter: { minEcc: 0.2 } },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onQueryExecute(query, { naturalQuery: query });
  };

  const handleChipClick = (suggestion: typeof SUGGESTED_QUERIES[0]) => {
    setQuery(suggestion.label);
    setActiveChip(suggestion.label);
    onQueryExecute(suggestion.label, suggestion.filter);
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto my-6 z-20">
      <form
        onSubmit={handleSubmit}
        className={`relative flex items-center bg-[#0D0F14]/90 backdrop-blur-xl border transition-all duration-300 rounded-2xl overflow-hidden shadow-2xl ${
          isFocused
            ? 'border-[#00F0FF]/60 shadow-[0_0_25px_rgba(0,240,255,0.15)] ring-1 ring-[#00F0FF]/40'
            : 'border-white/10 hover:border-white/20'
        }`}
      >
        <div className="pl-4 text-[#00F0FF] flex items-center">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask natural language queries (e.g., 'Show high-risk debris between 500km and 600km')..."
          className="w-full bg-transparent px-4 py-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-sans"
        />

        <div className="pr-4 flex items-center gap-2">
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-medium text-slate-400 bg-white/5 border border-white/10 rounded-md">
            <Command className="w-3 h-3" /> K
          </kbd>
          <button
            type="submit"
            className="p-2 bg-[#00F0FF] text-[#050608] hover:bg-[#00F0FF]/90 font-semibold rounded-xl transition-transform active:scale-95 flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.4)]"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Suggested Quick Prompts */}
      <div className="flex flex-wrap items-center gap-2 mt-3 px-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Telemetry Prompts:</span>
        {SUGGESTED_QUERIES.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleChipClick(item)}
            className={`text-xs px-3 py-1 rounded-full border transition-all duration-200 font-mono flex items-center gap-1.5 ${
              activeChip === item.label
                ? 'bg-[#00F0FF]/15 border-[#00F0FF]/40 text-[#00F0FF]'
                : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]/60" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

