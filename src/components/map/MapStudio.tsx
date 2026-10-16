/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Paintbrush,
  PaintBucket,
  Pipette,
  Grid,
  Volume2,
  CloudSun,
  Compass,
  Check,
  RotateCcw,
} from 'lucide-react';
import { DeltaManager } from '../../core/deltaManager';
import {
  MAP_BANKS_METADATA,
  MUSIC_TRACKS,
  WEATHERS,
} from '../../core/romData';
import { MapLayout } from '../../types/rom';
import { getMapLayout } from '../../core/romReader';

interface MapStudioProps {
  deltaManager: DeltaManager;
  romBuffer: Uint8Array;
  onDataChanged: () => void;
}

// 16 Metatiles with distinctive Hoenn colors and patterns
const METATILE_PALETTE = [
  { id: 0x00, name: 'Lawn Grass', color: '#388E3C', border: '#2E7D32', pattern: 'dots' },
  { id: 0x01, name: 'Dense Pine Tree', color: '#1B5E20', border: '#0D3810', pattern: 'tree' },
  { id: 0x02, name: 'Dirt Pathway', color: '#C99D66', border: '#B0834B', pattern: 'path' },
  { id: 0x03, name: 'Cobblestone Street', color: '#8D99AE', border: '#6C757D', pattern: 'brick' },
  { id: 0x04, name: 'Building Doorway', color: '#4A2810', border: '#331B0A', pattern: 'door' },
  { id: 0x05, name: 'Ledge Hill Cliff', color: '#A06D3B', border: '#784E23', pattern: 'ledge' },
  { id: 0x06, name: 'Wood House Wall', color: '#A67C52', border: '#805933', pattern: 'wood' },
  { id: 0x07, name: 'Clay Red Roof', color: '#B73225', border: '#8A1F15', pattern: 'roof' },
  { id: 0x08, name: 'Tall Wild Grass', color: '#2E7D32', border: '#1B5E20', pattern: 'tallgrass' },
  { id: 0x09, name: 'Blue Town Roof', color: '#1E6091', border: '#164E76', pattern: 'roof' },
  { id: 0x0a, name: 'White Picket Fence', color: '#E9ECEF', border: '#ADB5BD', pattern: 'fence' },
  { id: 0x0b, name: 'Route Signpost', color: '#6A4C2E', border: '#4E361F', pattern: 'sign' },
  { id: 0x0c, name: 'Flowerbed Garden', color: '#E63946', border: '#C1121F', pattern: 'flower' },
  { id: 0x0d, name: 'Mountain Rock', color: '#6C757D', border: '#495057', pattern: 'rock' },
  { id: 0x0e, name: 'Sandy Beach', color: '#E9D8A6', border: '#D4C38B', pattern: 'sand' },
  { id: 0x10, name: 'Deep Surf Water', color: '#0077B6', border: '#023E8A', pattern: 'water' },
];

const COLLISION_TAGS = [
  { flag: 0x00, name: 'Passable (Walk)', glyph: '·', color: 'rgba(74, 222, 128, 0.25)', border: '#4ade80' },
  { flag: 0x01, name: 'Impassable (Solid)', glyph: '✕', color: 'rgba(239, 68, 68, 0.45)', border: '#ef4444' },
  { flag: 0x0c, name: 'Tall Grass (Wild Encounters)', glyph: '🌿', color: 'rgba(16, 185, 129, 0.45)', border: '#10b981' },
  { flag: 0x10, name: 'Water (Surf)', glyph: '🌊', color: 'rgba(6, 182, 212, 0.45)', border: '#06b6d4' },
  { flag: 0x38, name: 'Ledge Hop (South)', glyph: '⬇', color: 'rgba(234, 179, 8, 0.45)', border: '#eab308' },
  { flag: 0x69, name: 'Doorway / Warp Trigger', glyph: '🚪', color: 'rgba(168, 85, 247, 0.45)', border: '#a855f7' },
];

export const MapStudio: React.FC<MapStudioProps> = ({
  deltaManager,
  romBuffer,
  onDataChanged,
}) => {
  const [selectedBankIdx, setSelectedBankIdx] = useState(0);
  const [selectedMapIdx, setSelectedMapIdx] = useState(9); // Default: Bank 0, Map 9 = Littleroot Town

  const activeBank = MAP_BANKS_METADATA[selectedBankIdx] || MAP_BANKS_METADATA[0];
  const activeMapMeta = activeBank.maps[selectedMapIdx] || activeBank.maps[0];

  const mapKey = `bank_${activeBank.bankId}_map_${activeMapMeta.mapId}`;

  // Layout state
  const defaultLayout = useMemo(() => {
    return getMapLayout(
      romBuffer,
      activeBank.bankId,
      activeMapMeta.mapId,
      activeMapMeta.width,
      activeMapMeta.height
    );
  }, [romBuffer, activeBank.bankId, activeMapMeta.mapId, activeMapMeta.width, activeMapMeta.height]);

  const activeLayout: MapLayout = useMemo(() => {
    return deltaManager.getEffectiveMap(mapKey, defaultLayout);
  }, [deltaManager, mapKey, defaultLayout, onDataChanged]);

  const isMapModified = !!deltaManager.getPatch().maps[mapKey];

  // Map header properties
  const [musicId, setMusicId] = useState(activeMapMeta.music || 0x163);
  const [weatherId, setWeatherId] = useState(0);
  const [caveFlag, setCaveFlag] = useState(false);

  // Editor tools
  const [activeTool, setActiveTool] = useState<'stamp' | 'bucket' | 'eyedropper'>('stamp');
  const [editMode, setEditMode] = useState<'metatiles' | 'collision'>('metatiles');
  const [selectedMetatileId, setSelectedMetatileId] = useState(0x08); // Tall grass
  const [selectedCollisionFlag, setSelectedCollisionFlag] = useState(0x0c); // Tall grass tag
  const [showGrid, setShowGrid] = useState(true);
  const [showCollisionOverlay, setShowCollisionOverlay] = useState(true);
  const [zoom, setZoom] = useState(1.5);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMouseDownRef = useRef(false);

  // Draw Map Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tileSize = 24 * zoom;
    const width = activeLayout.width;
    const height = activeLayout.height;

    canvas.width = width * tileSize;
    canvas.height = height * tileSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Render Metatile Layer
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const blockVal = activeLayout.blocks[idx] ?? 0;
        const meta = METATILE_PALETTE.find((m) => m.id === (blockVal & 0xff)) || METATILE_PALETTE[0];

        const px = x * tileSize;
        const py = y * tileSize;

        // Base tile fill
        ctx.fillStyle = meta.color;
        ctx.fillRect(px, py, tileSize, tileSize);

        // Subtle tile texture accent
        ctx.strokeStyle = meta.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);

        // Pattern glyph
        if (meta.pattern === 'tree') {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize / 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (meta.pattern === 'tallgrass') {
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(px + tileSize * 0.25, py + tileSize * 0.4, tileSize * 0.15, tileSize * 0.4);
          ctx.fillRect(px + tileSize * 0.6, py + tileSize * 0.3, tileSize * 0.15, tileSize * 0.5);
        } else if (meta.pattern === 'water') {
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(px + tileSize * 0.2, py + tileSize * 0.3, tileSize * 0.6, tileSize * 0.1);
          ctx.fillRect(px + tileSize * 0.2, py + tileSize * 0.6, tileSize * 0.6, tileSize * 0.1);
        } else if (meta.pattern === 'door') {
          ctx.fillStyle = '#221408';
          ctx.fillRect(px + tileSize * 0.2, py + tileSize * 0.2, tileSize * 0.6, tileSize * 0.8);
        } else if (meta.pattern === 'roof') {
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(px, py, tileSize, tileSize * 0.25);
        }

        // 2. Render Collision Overlay if enabled
        if (showCollisionOverlay) {
          const colFlag = activeLayout.collisions[idx] ?? 0;
          const colInfo = COLLISION_TAGS.find((c) => c.flag === colFlag) || COLLISION_TAGS[0];

          if (colFlag !== 0x00) {
            ctx.fillStyle = colInfo.color;
            ctx.fillRect(px, py, tileSize, tileSize);

            ctx.strokeStyle = colInfo.border;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);

            ctx.fillStyle = '#ffffff';
            ctx.font = `${Math.max(10, Math.floor(tileSize * 0.45))}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(colInfo.glyph, px + tileSize / 2, py + tileSize / 2);
          }
        }

        // 3. Grid Lines
        if (showGrid) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, tileSize, tileSize);
        }
      }
    }

    // Cursor hover highlight
    if (cursorPos && cursorPos.x >= 0 && cursorPos.x < width && cursorPos.y >= 0 && cursorPos.y < height) {
      const cx = cursorPos.x * tileSize;
      const cy = cursorPos.y * tileSize;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, tileSize, tileSize);
    }
  }, [activeLayout, showGrid, showCollisionOverlay, zoom, cursorPos]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getTileCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const tileSize = 24 * zoom;
    const tileX = Math.floor(x / tileSize);
    const tileY = Math.floor(y / tileSize);

    if (tileX >= 0 && tileX < activeLayout.width && tileY >= 0 && tileY < activeLayout.height) {
      return { x: tileX, y: tileY };
    }
    return null;
  };

  const applyTool = (coords: { x: number; y: number }) => {
    const index = coords.y * activeLayout.width + coords.x;

    if (activeTool === 'eyedropper') {
      if (editMode === 'metatiles') {
        const metatileVal = activeLayout.blocks[index] & 0xff;
        setSelectedMetatileId(metatileVal);
        setActiveTool('stamp');
      } else {
        const colVal = activeLayout.collisions[index];
        setSelectedCollisionFlag(colVal);
        setActiveTool('stamp');
      }
      return;
    }

    if (activeTool === 'stamp') {
      if (editMode === 'metatiles') {
        deltaManager.updateMapMetatile(mapKey, index, selectedMetatileId, activeLayout);
      } else {
        deltaManager.updateMapCollision(mapKey, index, selectedCollisionFlag, activeLayout);
      }
      onDataChanged();
    } else if (activeTool === 'bucket') {
      // Flood Fill
      const targetMetatile = activeLayout.blocks[index];
      const targetCol = activeLayout.collisions[index];
      const width = activeLayout.width;
      const height = activeLayout.height;

      const visited = new Uint8Array(width * height);
      const queue: [number, number][] = [[coords.x, coords.y]];

      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        const cidx = cy * width + cx;
        if (visited[cidx]) continue;
        visited[cidx] = 1;

        if (editMode === 'metatiles') {
          if (activeLayout.blocks[cidx] === targetMetatile) {
            deltaManager.updateMapMetatile(mapKey, cidx, selectedMetatileId, activeLayout);
            if (cx > 0) queue.push([cx - 1, cy]);
            if (cx < width - 1) queue.push([cx + 1, cy]);
            if (cy > 0) queue.push([cx, cy - 1]);
            if (cy < height - 1) queue.push([cx, cy + 1]);
          }
        } else {
          if (activeLayout.collisions[cidx] === targetCol) {
            deltaManager.updateMapCollision(mapKey, cidx, selectedCollisionFlag, activeLayout);
            if (cx > 0) queue.push([cx - 1, cy]);
            if (cx < width - 1) queue.push([cx + 1, cy]);
            if (cy > 0) queue.push([cx, cy - 1]);
            if (cy < height - 1) queue.push([cx, cy + 1]);
          }
        }
      }
      onDataChanged();
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isMouseDownRef.current = true;
    const coords = getTileCoords(e);
    if (coords) {
      applyTool(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getTileCoords(e);
    setCursorPos(coords);
    if (isMouseDownRef.current && coords && activeTool === 'stamp') {
      applyTool(coords);
    }
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#080c14] text-slate-200">
      {/* Top Map Selection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 bg-[#0d1322] border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Bank:</span>
            <select
              value={selectedBankIdx}
              onChange={(e) => {
                setSelectedBankIdx(parseInt(e.target.value));
                setSelectedMapIdx(0);
              }}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {MAP_BANKS_METADATA.map((bank, idx) => (
                <option key={bank.bankId} value={idx}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Map:</span>
            <select
              value={selectedMapIdx}
              onChange={(e) => setSelectedMapIdx(parseInt(e.target.value))}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-semibold"
            >
              {activeBank.maps.map((m, idx) => (
                <option key={m.mapId} value={idx}>
                  {m.name} ({m.width}×{m.height})
                </option>
              ))}
            </select>
            {isMapModified && (
              <button
                type="button"
                onClick={() => {
                  deltaManager.resetMap(mapKey);
                  onDataChanged();
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-amber-400 bg-amber-950/40 border border-amber-500/40 rounded-md hover:bg-amber-900/40 transition-colors"
                title="Reset map modifications back to original"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Map</span>
              </button>
            )}
          </div>
        </div>

        {/* View Controls & Zoom */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-md border border-slate-800">
            <button
              onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
              className="p-1 text-slate-400 hover:text-slate-200 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-slate-300 tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3.0, z + 0.25))}
              className="p-1 text-slate-400 hover:text-slate-200 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1.5)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded ml-0.5"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setShowGrid((g) => !g)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
              showGrid
                ? 'bg-slate-800 text-slate-200 border-slate-700'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>

          <button
            onClick={() => setShowCollisionOverlay((c) => !c)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
              showCollisionOverlay
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Collision Tags</span>
          </button>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbox & Palettes */}
        <div className="w-72 bg-[#0a0f1c] border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto p-4 space-y-5">
          {/* Mode Switcher */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Editing Target
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
              <button
                onClick={() => setEditMode('metatiles')}
                className={`py-1.5 text-xs font-semibold rounded transition-colors ${
                  editMode === 'metatiles'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Metatiles
              </button>
              <button
                onClick={() => {
                  setEditMode('collision');
                  setShowCollisionOverlay(true);
                }}
                className={`py-1.5 text-xs font-semibold rounded transition-colors ${
                  editMode === 'collision'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Collision Tags
              </button>
            </div>
          </div>

          {/* Tool Selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Toolbox
            </label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTool('stamp')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs rounded border transition-colors ${
                  activeTool === 'stamp'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>Stamp</span>
              </button>

              <button
                onClick={() => setActiveTool('bucket')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs rounded border transition-colors ${
                  activeTool === 'bucket'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <PaintBucket className="w-3.5 h-3.5" />
                <span>Fill</span>
              </button>

              <button
                onClick={() => setActiveTool('eyedropper')}
                className={`p-1.5 text-xs rounded border transition-colors ${
                  activeTool === 'eyedropper'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Eyedropper"
              >
                <Pipette className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Palette Selector */}
          {editMode === 'metatiles' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Metatile Blocks (16×16)
                </label>
                <span className="font-mono text-[11px] text-emerald-400">
                  ID: 0x{selectedMetatileId.toString(16).padStart(2, '0').toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {METATILE_PALETTE.map((meta) => {
                  const isSelected = meta.id === selectedMetatileId;
                  return (
                    <button
                      key={meta.id}
                      onClick={() => setSelectedMetatileId(meta.id)}
                      className={`relative aspect-square rounded p-1 flex flex-col items-center justify-center text-center transition-all ${
                        isSelected
                          ? 'ring-2 ring-emerald-400 scale-105 shadow-md shadow-emerald-500/20'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: meta.color }}
                      title={meta.name}
                    >
                      <span className="text-[9px] font-mono font-bold text-white drop-shadow">
                        0x{meta.id.toString(16).padStart(2, '0')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Collision Tags Palette */
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Collision Behavior Flags
                </label>
              </div>

              <div className="space-y-1.5">
                {COLLISION_TAGS.map((col) => {
                  const isSelected = col.flag === selectedCollisionFlag;
                  return (
                    <button
                      key={col.flag}
                      onClick={() => setSelectedCollisionFlag(col.flag)}
                      className={`w-full p-2 rounded text-left flex items-center justify-between text-xs border transition-colors ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500 text-white font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold font-mono text-white"
                          style={{ backgroundColor: col.border }}
                        >
                          {col.glyph}
                        </span>
                        <span>{col.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">
                        0x{col.flag.toString(16).padStart(2, '0').toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Coordinate Readout */}
          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Cursor:</span>
              <span className="text-slate-200">
                {cursorPos ? `X: ${cursorPos.x}, Y: ${cursorPos.y}` : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Metatiles:</span>
              <span className="text-slate-200">
                {activeLayout.width * activeLayout.height} blocks
              </span>
            </div>
          </div>
        </div>

        {/* Center Canvas Viewport */}
        <div className="flex-1 bg-[#05080f] overflow-auto flex items-center justify-center p-8 relative">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              isMouseDownRef.current = false;
              setCursorPos(null);
            }}
            className="cursor-crosshair shadow-2xl rounded border border-slate-800 bg-[#000]"
          />
        </div>

        {/* Right Map Properties Sidebar */}
        <div className="w-64 bg-[#0a0f1c] border-l border-slate-800 p-4 space-y-5 shrink-0 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>Map Header Properties</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Background Music</span>
              </label>
              <select
                value={musicId}
                onChange={(e) => setMusicId(parseInt(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {MUSIC_TRACKS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 flex items-center gap-1.5">
                <CloudSun className="w-3.5 h-3.5 text-slate-500" />
                <span>Weather Profile</span>
              </label>
              <select
                value={weatherId}
                onChange={(e) => setWeatherId(parseInt(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {WEATHERS.map((w, idx) => (
                  <option key={idx} value={idx}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Width (Tiles)</label>
                <input
                  type="text"
                  readOnly
                  value={activeLayout.width}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-400"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Height (Tiles)</label>
                <input
                  type="text"
                  readOnly
                  value={activeLayout.height}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-400"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={caveFlag}
                  onChange={(e) => setCaveFlag(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Cave Lighting Flag</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
