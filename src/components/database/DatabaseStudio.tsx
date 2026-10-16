/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Sparkles,
  RotateCcw,
  Shield,
  Zap,
  Heart,
  Sword,
  Gauge,
  Sliders,
  Package,
} from 'lucide-react';
import { DeltaManager } from '../../core/deltaManager';
import { OFFSETS } from '../../core/constants';
import {
  POKEMON_TYPES,
  TYPE_COLORS,
  ABILITIES,
  STANDARD_ITEMS,
  SPECIES_NAMES,
  GROWTH_RATES,
  EGG_GROUPS,
  EVOLUTION_METHODS,
  MOVES_LIST,
} from '../../core/romData';
import { BaseStats, ItemData } from '../../types/rom';
import { parseLearnset, parseEvolutions, decodeSpeciesSprite } from '../../core/romReader';

const RadarChart: React.FC<{ stats: BaseStats }> = ({ stats }) => {
  const maxVal = 200;
  const radius = 55;
  const centerX = 85;
  const centerY = 75;

  const statEntries = [
    { label: 'HP', val: stats.hp },
    { label: 'Atk', val: stats.attack },
    { label: 'Def', val: stats.defense },
    { label: 'Speed', val: stats.speed },
    { label: 'Sp.Def', val: stats.spDef },
    { label: 'Sp.Atk', val: stats.spAtk },
  ];

  const points = statEntries
    .map((st, i) => {
      const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
      const ratio = Math.min(1, Math.max(0.08, st.val / maxVal));
      const r = ratio * radius;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center justify-center p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
      <svg width={170} height={150} className="overflow-visible select-none">
        {gridLevels.map((lvl, idx) => {
          const polyPoints = Array.from({ length: 6 })
            .map((_, i) => {
              const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
              const r = lvl * radius;
              return `${(centerX + r * Math.cos(angle)).toFixed(1)},${(centerY + r * Math.sin(angle)).toFixed(1)}`;
            })
            .join(' ');
          return (
            <polygon
              key={idx}
              points={polyPoints}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          );
        })}

        {statEntries.map((_, i) => {
          const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
          const x2 = centerX + radius * Math.cos(angle);
          const y2 = centerY + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={centerX}
              y1={centerY}
              x2={x2}
              y2={y2}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          );
        })}

        <polygon
          points={points}
          fill="rgba(16, 185, 129, 0.25)"
          stroke="#10b981"
          strokeWidth={2}
        />

        {statEntries.map((st, i) => {
          const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
          const labelR = radius + 14;
          const lx = centerX + labelR * Math.cos(angle);
          const ly = centerY + labelR * Math.sin(angle);
          return (
            <text
              key={i}
              x={lx}
              y={ly}
              fill="#94a3b8"
              fontSize={8.5}
              fontFamily="monospace"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {st.label}
            </text>
          );
        })}
      </svg>
      <span className="text-[10px] font-mono text-emerald-400 mt-1">Stat Radar Visualizer</span>
    </div>
  );
};

const SpriteCanvas: React.FC<{ rom: Uint8Array; speciesId: number; isShiny: boolean }> = ({
  rom,
  speciesId,
  isShiny,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 64, 64);

    const decoded = decodeSpeciesSprite(rom, speciesId, isShiny);
    if (!decoded) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 64, 64);
      return;
    }

    const { pixels, palette } = decoded;
    const imgData = ctx.createImageData(64, 64);
    for (let i = 0; i < 64 * 64; i++) {
      const colIdx = pixels[i];
      const col = palette[colIdx] || palette[0];
      const p = i * 4;
      imgData.data[p] = col.r;
      imgData.data[p + 1] = col.g;
      imgData.data[p + 2] = col.b;
      imgData.data[p + 3] = colIdx === 0 && col.a === 0 ? 0 : 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }, [rom, speciesId, isShiny]);

  return (
    <canvas
      ref={canvasRef}
      width={64}
      height={64}
      className="w-14 h-14 rounded-lg bg-slate-950 border border-slate-800 shadow-inner [image-rendering:pixelated] shrink-0"
    />
  );
};

interface DatabaseStudioProps {
  deltaManager: DeltaManager;
  romBuffer: Uint8Array;
  onDataChanged: () => void;
}

export const DatabaseStudio: React.FC<DatabaseStudioProps> = ({
  deltaManager,
  romBuffer,
  onDataChanged,
}) => {
  const [subTab, setSubTab] = useState<'pokemon' | 'items'>('pokemon');
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number>(277); // Default to Treecko
  const [selectedItemId, setSelectedItemId] = useState<number>(13); // Default to Potion
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [isShinySprite, setIsShinySprite] = useState(false);

  // Filtered Pokémon species
  const filteredSpecies = useMemo(() => {
    return SPECIES_NAMES.map((name, id) => ({ id, name }))
      .filter((sp) => sp.id > 0)
      .filter((sp) => {
        const matchesQuery =
          sp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sp.id.toString().includes(searchQuery);
        if (!matchesQuery) return false;
        if (selectedTypeFilter === 'All') return true;
        const stats = deltaManager.getEffectiveBaseStats(sp.id);
        const t1 = POKEMON_TYPES[stats.type1];
        const t2 = POKEMON_TYPES[stats.type2];
        return t1 === selectedTypeFilter || t2 === selectedTypeFilter;
      });
  }, [searchQuery, selectedTypeFilter, deltaManager]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return STANDARD_ITEMS.map((name, id) => ({ id, name }))
      .filter((it) => it.id > 0)
      .filter((it) =>
        it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.id.toString().includes(searchQuery)
      );
  }, [searchQuery]);

  // Active species data
  const activeStats: BaseStats = useMemo(() => {
    return deltaManager.getEffectiveBaseStats(selectedSpeciesId);
  }, [deltaManager, selectedSpeciesId, onDataChanged]);

  // Check if species is modified in patch
  const isSpeciesModified = !!deltaManager.getPatch().baseStats[selectedSpeciesId];

  // Active item data
  const activeItem: ItemData = useMemo(() => {
    return deltaManager.getEffectiveItem(selectedItemId);
  }, [deltaManager, selectedItemId, onDataChanged]);

  const isItemModified = !!deltaManager.getPatch().items[selectedItemId];

  // Moveset and evolutions for current species
  const moveset = useMemo(() => {
    return parseLearnset(romBuffer, selectedSpeciesId);
  }, [romBuffer, selectedSpeciesId]);

  const evolutions = useMemo(() => {
    return parseEvolutions(romBuffer, selectedSpeciesId);
  }, [romBuffer, selectedSpeciesId]);

  const handleStatChange = (key: keyof BaseStats, value: number) => {
    deltaManager.updateBaseStats(selectedSpeciesId, { [key]: value });
    onDataChanged();
  };

  const handleItemChange = (key: keyof ItemData, value: any) => {
    deltaManager.updateItem(selectedItemId, { [key]: value });
    onDataChanged();
  };

  const handleResetSpecies = () => {
    deltaManager.resetSpecies(selectedSpeciesId);
    onDataChanged();
  };

  const handleResetItem = () => {
    deltaManager.resetItem(selectedItemId);
    onDataChanged();
  };

  // Base Stat Total calculation
  const bst =
    activeStats.hp +
    activeStats.attack +
    activeStats.defense +
    activeStats.spAtk +
    activeStats.spDef +
    activeStats.speed;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090d16] text-slate-200">
      {/* Sub-navigation bar */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#0d1322] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                setSubTab('pokemon');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                subTab === 'pokemon'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pokémon & Base Stats</span>
            </button>
            <button
              onClick={() => {
                setSubTab('items');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                subTab === 'items'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-emerald-400" />
              <span>Items & Economy</span>
            </button>
          </div>
        </div>

        {/* Search & Type filter */}
        <div className="flex items-center gap-3">
          {subTab === 'pokemon' && (
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="All">All Types</option>
              {POKEMON_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={subTab === 'pokemon' ? 'Search species...' : 'Search items...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar List */}
        <div className="w-72 bg-[#0a0f1c] border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>{subTab === 'pokemon' ? 'Species Directory' : 'Item Catalog'}</span>
            <span className="font-mono text-[11px] text-slate-500">
              {subTab === 'pokemon' ? filteredSpecies.length : filteredItems.length} entries
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {subTab === 'pokemon'
              ? filteredSpecies.map((sp) => {
                  const isModified = !!deltaManager.getPatch().baseStats[sp.id];
                  const isSelected = sp.id === selectedSpeciesId;
                  return (
                    <button
                      key={sp.id}
                      onClick={() => setSelectedSpeciesId(sp.id)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-emerald-950/40 border-l-2 border-emerald-400 text-white'
                          : 'hover:bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500 w-8">
                          #{sp.id.toString().padStart(3, '0')}
                        </span>
                        <span className="text-xs font-medium">{sp.name}</span>
                      </div>
                      {isModified && (
                        <span className="text-[10px] font-mono font-medium text-amber-400 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-600/30">
                          MOD
                        </span>
                      )}
                    </button>
                  );
                })
              : filteredItems.map((it) => {
                  const isModified = !!deltaManager.getPatch().items[it.id];
                  const isSelected = it.id === selectedItemId;
                  return (
                    <button
                      key={it.id}
                      onClick={() => setSelectedItemId(it.id)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-emerald-950/40 border-l-2 border-emerald-400 text-white'
                          : 'hover:bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500 w-8">
                          #{it.id.toString().padStart(3, '0')}
                        </span>
                        <span className="text-xs font-medium">{it.name}</span>
                      </div>
                      {isModified && (
                        <span className="text-[10px] font-mono font-medium text-amber-400 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-600/30">
                          MOD
                        </span>
                      )}
                    </button>
                  );
                })}
          </div>
        </div>

        {/* Right Editor Pane */}
        {subTab === 'pokemon' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                  <SpriteCanvas rom={romBuffer} speciesId={selectedSpeciesId} isShiny={isShinySprite} />
                  <button
                    type="button"
                    onClick={() => setIsShinySprite((s) => !s)}
                    className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors border ${
                      isShinySprite
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-extrabold shadow-sm'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                    title="Toggle Normal vs Shiny Palette"
                  >
                    {isShinySprite ? '★ Shiny' : 'Normal'}
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl font-bold text-slate-500">
                      #{selectedSpeciesId.toString().padStart(3, '0')}
                    </span>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{activeStats.name}</h2>
                    <div className="flex items-center gap-1.5 ml-1">
                      <span
                        className="px-2.5 py-0.5 rounded text-xs font-semibold text-white uppercase tracking-wider"
                        style={{ backgroundColor: TYPE_COLORS[POKEMON_TYPES[activeStats.type1]] || '#666' }}
                      >
                        {POKEMON_TYPES[activeStats.type1]}
                      </span>
                      {activeStats.type2 !== activeStats.type1 && (
                        <span
                          className="px-2.5 py-0.5 rounded text-xs font-semibold text-white uppercase tracking-wider"
                          style={{ backgroundColor: TYPE_COLORS[POKEMON_TYPES[activeStats.type2]] || '#666' }}
                        >
                          {POKEMON_TYPES[activeStats.type2]}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    Front Sprite LZ77 Offset: 0x{(OFFSETS.FRONT_SPRITES_PTR_TABLE + selectedSpeciesId * 8).toString(16).toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                  <span className="text-xs text-slate-400 font-medium">Base Stat Total (BST):</span>
                  <span className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
                    {bst}
                  </span>
                </div>

                {isSpeciesModified && (
                  <button
                    onClick={handleResetSpecies}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Species</span>
                  </button>
                )}
              </div>
            </div>

            {/* Base Stats Matrix & Visual Bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stat Sliders */}
              <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>28-Byte Base Stats Breakdown</span>
                </h3>

                {[
                  { key: 'hp', label: 'HP', val: activeStats.hp, icon: Heart, color: 'bg-red-500' },
                  { key: 'attack', label: 'Attack', val: activeStats.attack, icon: Sword, color: 'bg-orange-500' },
                  { key: 'defense', label: 'Defense', val: activeStats.defense, icon: Shield, color: 'bg-yellow-500' },
                  { key: 'spAtk', label: 'Sp. Atk', val: activeStats.spAtk, icon: Zap, color: 'bg-blue-500' },
                  { key: 'spDef', label: 'Sp. Def', val: activeStats.spDef, icon: Shield, color: 'bg-indigo-500' },
                  { key: 'speed', label: 'Speed', val: activeStats.speed, icon: Gauge, color: 'bg-emerald-500' },
                ].map(({ key, label, val, icon: Icon, color }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{label}</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="255"
                        value={val}
                        onChange={(e) => handleStatChange(key as keyof BaseStats, parseInt(e.target.value) || 1)}
                        className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500 tabular-nums"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} transition-all duration-150`}
                          style={{ width: `${Math.min(100, (val / 255) * 100)}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="255"
                        value={val}
                        onChange={(e) => handleStatChange(key as keyof BaseStats, parseInt(e.target.value))}
                        className="w-28 accent-emerald-400"
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-center">
                  <RadarChart stats={activeStats} />
                </div>
              </div>

              {/* Typing, Catch Rate, Exp & Abilities */}
              <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Species Attributes & Typing
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Primary Type</label>
                    <select
                      value={activeStats.type1}
                      onChange={(e) => handleStatChange('type1', parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      {POKEMON_TYPES.map((t, idx) => (
                        <option key={idx} value={idx}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Secondary Type</label>
                    <select
                      value={activeStats.type2}
                      onChange={(e) => handleStatChange('type2', parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      {POKEMON_TYPES.map((t, idx) => (
                        <option key={idx} value={idx}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Ability 1</label>
                    <select
                      value={activeStats.ability1}
                      onChange={(e) => handleStatChange('ability1', parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      {ABILITIES.map((ab, idx) => (
                        <option key={idx} value={idx}>
                          {ab}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Ability 2</label>
                    <select
                      value={activeStats.ability2}
                      onChange={(e) => handleStatChange('ability2', parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      {ABILITIES.map((ab, idx) => (
                        <option key={idx} value={idx}>
                          {ab}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Catch Rate (1-255)</label>
                    <input
                      type="number"
                      min="1"
                      max="255"
                      value={activeStats.catchRate}
                      onChange={(e) => handleStatChange('catchRate', parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Base Exp Yield</label>
                    <input
                      type="number"
                      min="1"
                      max="600"
                      value={activeStats.baseExpYield}
                      onChange={(e) => handleStatChange('baseExpYield', parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Growth Rate</label>
                    <select
                      value={activeStats.growthRate}
                      onChange={(e) => handleStatChange('growthRate', parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      {GROWTH_RATES.map((g, idx) => (
                        <option key={idx} value={idx}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Base Friendship</label>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={activeStats.baseFriendship}
                      onChange={(e) => handleStatChange('baseFriendship', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Held Item 1 (50%)</label>
                    <select
                      value={activeStats.item1}
                      onChange={(e) => handleStatChange('item1', parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      {STANDARD_ITEMS.map((item, idx) => (
                        <option key={idx} value={idx}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Held Item 2 (5%)</label>
                    <select
                      value={activeStats.item2}
                      onChange={(e) => handleStatChange('item2', parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      {STANDARD_ITEMS.map((item, idx) => (
                        <option key={idx} value={idx}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Evolutions & Level-up Movesets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Moveset */}
              <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                  <span>Level-Up Learnset (ROM Pointers)</span>
                  <span className="font-mono text-emerald-400">{moveset.length} moves</span>
                </h3>

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60 font-mono text-xs">
                  {moveset.map((m, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between text-slate-300">
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-semibold w-12">
                          Lv. {m.level}
                        </span>
                        <span>{MOVES_LIST[m.moveId] || `Move #${m.moveId}`}</span>
                      </div>
                      <span className="text-slate-500 text-[11px]">ID:{m.moveId}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evolutions */}
              <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Evolution Pathways
                </h3>

                {evolutions.length > 0 ? (
                  <div className="space-y-2 font-mono text-xs">
                    {evolutions.map((evo, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-900/80 border border-slate-800 rounded flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <span className="text-slate-400 text-[11px] block">
                            Method: {EVOLUTION_METHODS[evo.method] || `Method ${evo.method}`}
                          </span>
                          <span className="text-emerald-300 font-semibold">
                            Target: {SPECIES_NAMES[evo.targetSpecies] || `Species #${evo.targetSpecies}`}
                          </span>
                        </div>
                        <span className="text-slate-500 text-[11px]">Param: {evo.param}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-6 text-center">
                    No further evolutions or final stage species.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Item Editor */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl font-bold text-slate-500">
                  #{selectedItemId.toString().padStart(3, '0')}
                </span>
                <h2 className="text-2xl font-bold text-white tracking-tight">{activeItem.name}</h2>
              </div>

              {isItemModified && (
                <button
                  onClick={handleResetItem}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Item</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  44-Byte Item Economics & Properties
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Item Name (GBA Encoded)</label>
                    <input
                      type="text"
                      maxLength={14}
                      value={activeItem.name}
                      onChange={(e) => handleItemChange('name', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Price (Pokédollars ¥)</label>
                    <input
                      type="number"
                      min="0"
                      max="65535"
                      value={activeItem.price}
                      onChange={(e) => handleItemChange('price', parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-emerald-400 font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Bag Pocket</label>
                    <select
                      value={activeItem.pocket}
                      onChange={(e) => handleItemChange('pocket', parseInt(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value={1}>Items</option>
                      <option value={2}>Key Items</option>
                      <option value={3}>Poké Balls</option>
                      <option value={4}>TMs & HMs</option>
                      <option value={5}>Berries</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Item Description String
                </h3>

                <div className="space-y-2 text-xs">
                  <textarea
                    rows={4}
                    value={activeItem.description}
                    onChange={(e) => handleItemChange('description', e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-mono"
                    placeholder="In-game inventory item description..."
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>Target Pointer: 0x{activeItem.descriptionPtr.toString(16).toUpperCase()}</span>
                    <span>{activeItem.description.length} chars</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
