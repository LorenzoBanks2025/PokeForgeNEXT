/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Binary,
  Download,
  Save,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import { DeltaManager } from '../core/deltaManager';
import { calculateGBAHeaderChecksum } from '../core/checksum';
import { BinaryDiff } from '../types/rom';

interface DiffViewerProps {
  deltaManager: DeltaManager;
  romBuffer: Uint8Array;
  onSaveForge: () => void;
  onExportRom: () => void;
  onLoadForgeClick: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  deltaManager,
  romBuffer,
  onSaveForge,
  onExportRom,
  onLoadForgeClick,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const diffs: BinaryDiff[] = useMemo(() => {
    return deltaManager.generateDiffs();
  }, [deltaManager]);

  const patch = deltaManager.getPatch();
  const modifiedSpeciesCount = Object.keys(patch.baseStats).length;
  const modifiedItemsCount = Object.keys(patch.items).length;
  const modifiedMapsCount = Object.keys(patch.maps).length;
  const modifiedTextsCount = Object.keys(patch.texts).length;

  const filteredDiffs = useMemo(() => {
    if (!filterQuery) return diffs;
    return diffs.filter(
      (d) =>
        d.description.toLowerCase().includes(filterQuery.toLowerCase()) ||
        d.offset.toString(16).toLowerCase().includes(filterQuery.toLowerCase())
    );
  }, [diffs, filterQuery]);

  // Check header checksum
  const headerChecksum = calculateGBAHeaderChecksum(romBuffer);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#080c14] text-slate-200">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 bg-[#0d1322] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Binary className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Binary Delta Inspector & Patch Compiler
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSaveForge}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 rounded-md transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save .forge Archive</span>
          </button>

          <button
            onClick={onExportRom}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-md shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Build & Download .gba</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 font-medium">Modified Bytes</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {diffs.length}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Isolated in memory deltas</span>
          </div>

          <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 font-medium">Pokémon Base Stats</span>
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {modifiedSpeciesCount}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">28-byte stat records</span>
          </div>

          <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 font-medium">Item Modifications</span>
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {modifiedItemsCount}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">44-byte item structs</span>
          </div>

          <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 font-medium">BIOS Checksum (0xBD)</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                0x{headerChecksum.toString(16).toUpperCase().padStart(2, '0')}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Auto-patched on export</span>
          </div>
        </div>

        {/* Patch Pipeline Description */}
        <div className="p-4 bg-[#0b101d] border border-slate-800 rounded-xl flex items-start gap-3">
          <FileCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-white">Non-Destructive Delta Pipeline</h4>
            <p className="text-slate-400 leading-relaxed">
              PokeForge leaves the original 16MB ROM buffer uncorrupted. Modifications are tracked
              as lightweight JSON and binary patch layers. When exporting, delta bytes are sequentially
              injected, pointer boundaries verified, and the standard Nintendo BIOS complement
              checksum at byte offset 0xBD is automatically recalculated:
            </p>
            <div className="font-mono text-emerald-300 text-[11px] pt-1">
              Checksum = -sum(ROM[0xA0..0xBC]) - 0x19 (mod 0x100)
            </div>
          </div>
        </div>

        {/* Binary Differences Table */}
        <div className="bg-[#0d1322] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Physical ROM Offset Differences
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ({filteredDiffs.length} bytes)
              </span>
            </div>

            <input
              type="text"
              placeholder="Filter by description or offset..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-60"
            />
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filteredDiffs.length > 0 ? (
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[11px] sticky top-0">
                  <tr>
                    <th className="py-2 px-4">ROM Offset</th>
                    <th className="py-2 px-4">GBA Pointer</th>
                    <th className="py-2 px-4">Original</th>
                    <th className="py-2 px-4">Patched</th>
                    <th className="py-2 px-4">Target Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredDiffs.map((diff, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 px-4 text-emerald-400">
                        0x{diff.offset.toString(16).toUpperCase().padStart(6, '0')}
                      </td>
                      <td className="py-2 px-4 text-slate-400">
                        0x{(diff.offset + 0x08000000).toString(16).toUpperCase()}
                      </td>
                      <td className="py-2 px-4 text-slate-500">
                        0x{diff.originalByte.toString(16).toUpperCase().padStart(2, '0')}
                      </td>
                      <td className="py-2 px-4 text-emerald-300 font-bold">
                        0x{diff.newByte.toString(16).toUpperCase().padStart(2, '0')}
                      </td>
                      <td className="py-2 px-4 text-slate-300 font-sans">{diff.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                {diffs.length === 0
                  ? 'No modifications made yet. Edit base stats, items, or text to see binary diffs.'
                  : 'No binary diffs matched your filter query.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
