/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Code2,
  Terminal,
  Check,
  RotateCcw,
} from 'lucide-react';
import { DeltaManager } from '../../core/deltaManager';
import { decodeGBAText, encodeGBAText } from '../../core/gbaText';

interface TextStudioProps {
  deltaManager: DeltaManager;
  romBuffer: Uint8Array;
  onDataChanged: () => void;
}

interface StringEntry {
  offset: number;
  label: string;
  defaultText: string;
}

const SAMPLE_STRINGS: StringEntry[] = [
  {
    offset: 0x5e1200,
    label: 'Professor Birch: Welcome Intro',
    defaultText: 'Hi! Sorry to keep you waiting!\\pWelcome to the world of POKéMON!\\nMy name is BIRCH.\\pThis world is widely inhabited by\\ncreatures called POKéMON.\\lWe humans live alongside POKéMON.',
  },
  {
    offset: 0x5e1450,
    label: 'Littleroot Town: Town Signpost',
    defaultText: 'LITTLEROOT TOWN\\n“A town that can’t be shaded\\lany hue.”',
  },
  {
    offset: 0x5e1680,
    label: 'Petalburg Gym: Leader Norman',
    defaultText: 'Hm? Well, if it isn’t [PLAYER]!\\pSo you’ve come all this way.\\nI will battle you seriously!\\lShow me how much you have grown!',
  },
  {
    offset: 0x5e1890,
    label: 'Poké Mart: Clerk Greeting',
    defaultText: 'Welcome!\\nHow may I serve you today?',
  },
  {
    offset: 0x5e2100,
    label: 'Weather Institute: Scientist Alert',
    defaultText: 'The weather patterns in HOENN\\nare shifting drastically!\\pIt could be the legendary POKéMON!',
  },
];

export const TextStudio: React.FC<TextStudioProps> = ({
  deltaManager,
  romBuffer,
  onDataChanged,
}) => {
  const [selectedEntryIdx, setSelectedEntryIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const activeEntry = SAMPLE_STRINGS[selectedEntryIdx] || SAMPLE_STRINGS[0];

  // Retrieve patched text if modified, otherwise default
  const activeText = useMemo(() => {
    const patch = deltaManager.getPatch().texts[activeEntry.offset];
    return patch !== undefined ? patch : activeEntry.defaultText;
  }, [deltaManager, activeEntry, onDataChanged]);

  const isModified = deltaManager.getPatch().texts[activeEntry.offset] !== undefined;

  // Compute GBA bytecode
  const encodedBytes = useMemo(() => {
    return encodeGBAText(activeText);
  }, [activeText]);

  const handleTextChange = (newText: string) => {
    deltaManager.updateText(activeEntry.offset, newText);
    onDataChanged();
  };

  const handleReset = () => {
    const patch = deltaManager.getPatch();
    delete patch.texts[activeEntry.offset];
    onDataChanged();
  };

  const insertTag = (tag: string) => {
    handleTextChange(activeText + tag);
  };

  // Format preview for in-game dialogue box: replace \p with page divider, \n with linebreak, \l with scroll line
  const formattedPreviewLines = useMemo(() => {
    return activeText
      .replace(/\[PLAYER\]/g, 'BRENDAN')
      .replace(/\[RIVAL\]/g, 'MAY')
      .replace(/\[PK\]/g, 'PK')
      .replace(/\[MN\]/g, 'MN')
      .split(/\\p/);
  }, [activeText]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#080c14] text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#0d1322] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            GBA Script & String Localization Studio
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>Encoding: Gen 3 Custom Charset</span>
          <span>·</span>
          <span>Terminator: 0xFF</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left String Table */}
        <div className="w-80 bg-[#0a0f1c] border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Dialogue Tables
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {SAMPLE_STRINGS.length} strings
            </span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {SAMPLE_STRINGS.map((entry, idx) => {
              const isSelected = idx === selectedEntryIdx;
              const hasMod = deltaManager.getPatch().texts[entry.offset] !== undefined;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedEntryIdx(idx)}
                  className={`w-full p-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-emerald-950/40 border-l-2 border-emerald-400 text-white'
                      : 'hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs truncate max-w-[190px]">
                      {entry.label}
                    </span>
                    {hasMod && (
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-950/50 px-1 rounded border border-amber-800/40">
                        MOD
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    0x{entry.offset.toString(16).toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: String Editor & Live Bytecode */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">{activeEntry.label}</h2>
              <span className="font-mono text-xs text-emerald-400">
                Target ROM Offset: 0x{activeEntry.offset.toString(16).toUpperCase()}
              </span>
            </div>

            {isModified && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset String</span>
              </button>
            )}
          </div>

          {/* Quick macro inserts */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-2 font-medium">Quick Tags:</span>
            {[
              { label: '\\n (Newline)', val: '\\n' },
              { label: '\\l (Scroll)', val: '\\l' },
              { label: '\\p (Page)', val: '\\p' },
              { label: '[PLAYER]', val: '[PLAYER]' },
              { label: '[RIVAL]', val: '[RIVAL]' },
              { label: '[PK][MN]', val: '[PK][MN]' },
            ].map(({ label, val }) => (
              <button
                key={val}
                onClick={() => insertTag(val)}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700/80 rounded font-mono text-xs transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <div className="space-y-2">
            <textarea
              rows={6}
              value={activeText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full p-4 bg-[#0d1322] border border-slate-700 rounded-xl text-slate-100 font-mono text-sm leading-relaxed focus:outline-none focus:border-emerald-500 shadow-inner"
              placeholder="Enter Pokémon Emerald dialogue string..."
            />
            <div className="flex justify-between items-center text-xs font-mono text-slate-500 px-1">
              <span>Length: {activeText.length} characters</span>
              <span className="text-emerald-400">
                Compiled Bytecode: {encodedBytes.length} bytes (incl. 0xFF terminator)
              </span>
            </div>
          </div>

          {/* Authentic GBA Dialogue Box Simulation */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>GBA Dialogue Window Simulation</span>
            </h3>

            <div className="bg-[#111827] p-5 rounded-2xl border border-slate-800 max-w-xl shadow-xl">
              <div className="bg-[#f8f9fa] border-4 border-[#334155] rounded-lg p-4 min-h-[96px] text-slate-900 font-mono text-sm leading-6 shadow-inner relative flex flex-col justify-between">
                <div className="space-y-1">
                  {formattedPreviewLines[0]?.split(/\\n|\\l/).map((line, lIdx) => (
                    <div key={lIdx} className="tracking-wide font-medium">
                      {line}
                    </div>
                  ))}
                </div>
                <div className="self-end animate-bounce text-red-600 text-xs font-bold">▼</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
