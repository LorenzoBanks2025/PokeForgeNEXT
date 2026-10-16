/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Database,
  Map as MapIcon,
  Palette,
  FileText,
  Binary,
  Download,
  Save,
  RotateCcw,
  RotateCw,
  FolderOpen,
} from 'lucide-react';

export type StudioTab = 'database' | 'map' | 'graphics' | 'text' | 'diffs';

interface TopBarProps {
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  gameCode: string;
  gameTitle: string;
  crc32Hex: string;
  modifiedCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveForge: () => void;
  onExportRom: () => void;
  onNewRom: () => void;
  onLoadForgeClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  gameCode,
  gameTitle,
  crc32Hex,
  modifiedCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveForge,
  onExportRom,
  onNewRom,
  onLoadForgeClick,
}) => {
  return (
    <header className="flex items-center justify-between gap-6 px-6 py-3 bg-[#0a0f1d] border-b border-slate-800 text-slate-200 shrink-0">
      {/* Zone 1: Brand Wordmark & ROM Info */}
      <div className="flex items-center gap-4 whitespace-nowrap shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs tracking-wider">
            PF
          </div>
          <span className="font-bold text-base tracking-tight text-white">
            Poke<span className="text-emerald-400">Forge</span>
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 font-mono pl-3 border-l border-slate-800">
          <span className="text-emerald-400 font-semibold">{gameCode}</span>
          <span aria-hidden="true">·</span>
          <span>{gameTitle}</span>
          <span aria-hidden="true">·</span>
          <span className="text-slate-400">CRC:{crc32Hex}</span>
          {modifiedCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-medium">
                {modifiedCount} patch{modifiedCount > 1 ? 'es' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Zone 2: Studio Tabs & Undo/Redo */}
      <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => onTabChange('database')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'database'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Database Studio</span>
        </button>

        <button
          onClick={() => onTabChange('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'map'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>Map Studio</span>
        </button>

        <button
          onClick={() => onTabChange('graphics')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'graphics'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-emerald-400" />
          <span>Graphics Studio</span>
        </button>

        <button
          onClick={() => onTabChange('text')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'text'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>Script & Text</span>
        </button>

        <button
          onClick={() => onTabChange('diffs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'diffs'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Binary className="w-3.5 h-3.5 text-emerald-400" />
          <span>ROM Diffs</span>
        </button>

        <div className="w-px h-4 bg-slate-800 mx-1" />

        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo modification"
          className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 rounded transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo modification"
          className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 rounded transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </nav>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
        <button
          onClick={onLoadForgeClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-700/80 rounded-md transition-colors"
          title="Load .forge workspace archive"
        >
          <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Load .forge</span>
        </button>

        <button
          onClick={onSaveForge}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-700/50 rounded-md transition-colors"
          title="Save non-destructive .forge project ZIP"
        >
          <Save className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Save .forge</span>
        </button>

        <button
          onClick={onExportRom}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md shadow-sm transition-colors"
          title="Build patched .gba file with verified BIOS checksum"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export .gba</span>
        </button>

        <button
          onClick={onNewRom}
          className="text-xs text-slate-500 hover:text-slate-300 ml-1 transition-colors"
          title="Unload current ROM"
        >
          Eject
        </button>
      </div>
    </header>
  );
};
