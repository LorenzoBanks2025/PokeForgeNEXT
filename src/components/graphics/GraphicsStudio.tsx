/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Palette as PaletteIcon,
  Upload,
  Paintbrush,
  Eraser,
  FlipHorizontal,
  FlipVertical,
  Sliders,
  Maximize2,
  Grid,
} from 'lucide-react';
import {
  RGBAColor,
  bgr555ToRgba,
  rgbToBgr555,
  rgbaToHex,
  hexToRgb,
  quantizeTo16Colors,
} from '../../core/color';
import { readTileset, readPalette } from '../../core/romReader';

interface GraphicsStudioProps {
  romBuffer: Uint8Array;
  onDataChanged: () => void;
  tilesetPtr?: number;
  palettePtr?: number;
}

// Default 16-color Emerald outdoor palette in 15-bit BGR format
const DEFAULT_PALETTE_BGR: number[] = [
  0x7c1f, // 0: Sky / Background
  0x1f00, // 1: Dark Pine Green
  0x2e83, // 2: Medium Lawn Green
  0x4fa6, // 3: Bright Jade Leaf
  0x0180, // 4: Deep Shadow
  0x1e35, // 5: Dirt Brown
  0x3ef8, // 6: Warm Sand
  0x5b7d, // 7: Cobblestone Gray
  0x7fff, // 8: Pure White
  0x001f, // 9: Vivid Red
  0x02df, // 10: Bright Orange
  0x03e0, // 11: Pure Green
  0x7c00, // 12: Pure Blue
  0x7e00, // 13: Cyan
  0x03ff, // 14: Golden Yellow
  0x0000, // 15: Black Outline
];

export const GraphicsStudio: React.FC<GraphicsStudioProps> = ({
  romBuffer,
  onDataChanged,
  tilesetPtr,
  palettePtr,
}) => {
  // 16-color palette state
  const [palette, setPalette] = useState<RGBAColor[]>(() =>
    palettePtr
      ? readPalette(romBuffer, palettePtr)
      : DEFAULT_PALETTE_BGR.map((bgr, idx) => bgr555ToRgba(bgr, idx === 0))
  );
  const [selectedColorIdx, setSelectedColorIdx] = useState<number>(3);

  // 16 tiles in memory (each tile has 64 pixels, values 0..15)
  const [tiles, setTiles] = useState<number[][]>(() => {
    if (tilesetPtr) return readTileset(romBuffer, tilesetPtr);
    return Array.from({ length: 16 }, (_, tileIdx) => {
      const pixels = new Array(64).fill(0);
      // Generate interesting starter tile patterns
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const idx = y * 8 + x;
          if (tileIdx === 0) {
            // Grass
            pixels[idx] = (x + y) % 3 === 0 ? 2 : 3;
          } else if (tileIdx === 1) {
            // Tree trunk
            pixels[idx] = x >= 2 && x <= 5 ? 5 : 0;
          } else if (tileIdx === 2) {
            // Water ripples
            pixels[idx] = y === 3 || y === 6 ? 13 : 12;
          } else if (tileIdx === 3) {
            // Red Poké Ball
            const dist = Math.hypot(x - 3.5, y - 3.5);
            if (dist < 3.2) {
              pixels[idx] = y < 4 ? 9 : 8;
              if (y === 3 || y === 4) pixels[idx] = 15;
              if (Math.hypot(x - 3.5, y - 3.5) < 1.2) pixels[idx] = 8;
            }
          } else {
            pixels[idx] = (x ^ y) % 8;
          }
        }
      }
      return pixels;
    });
  });

  useEffect(() => {
    if (tilesetPtr) setTiles(readTileset(romBuffer, tilesetPtr));
    if (palettePtr) setPalette(readPalette(romBuffer, palettePtr));
  }, [tilesetPtr, palettePtr, romBuffer]);

  const [activeTileIdx, setActiveTileIdx] = useState<number>(3);
  const [activeTool, setActiveTool] = useState<'pencil' | 'eraser'>('pencil');
  const [showGrid, setShowGrid] = useState<boolean>(true);

  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMouseDownRef = useRef<boolean>(false);

  const activePixels = tiles[activeTileIdx] || new Array(64).fill(0);
  const activeColor = palette[selectedColorIdx] || palette[0];

  // 15-bit BGR555 representation
  const bgr555 = rgbToBgr555(activeColor.r, activeColor.g, activeColor.b);
  const r5 = bgr555 & 0x1f;
  const g5 = (bgr555 >> 5) & 0x1f;
  const b5 = (bgr555 >> 10) & 0x1f;

  // Render 8x8 zoomed pixel canvas
  const renderPixelCanvas = useCallback(() => {
    const canvas = pixelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 32; // 32px per tile pixel -> 256x256 total
    canvas.width = 8 * size;
    canvas.height = 8 * size;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const idx = y * 8 + x;
        const colorIdx = activePixels[idx];
        const col = palette[colorIdx] || palette[0];

        if (colorIdx === 0 && col.a === 0) {
          // Render checkerboard for transparency
          const isCheck = (x + y) % 2 === 0;
          ctx.fillStyle = isCheck ? '#1e293b' : '#0f172a';
          ctx.fillRect(x * size, y * size, size, size);
        } else {
          ctx.fillStyle = rgbaToHex(col);
          ctx.fillRect(x * size, y * size, size, size);
        }

        if (showGrid) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x * size, y * size, size, size);
        }
      }
    }
  }, [activePixels, palette, showGrid]);

  useEffect(() => {
    renderPixelCanvas();
  }, [renderPixelCanvas]);

  const paintPixel = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = pixelCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / 32);
    const y = Math.floor((e.clientY - rect.top) / 32);

    if (x >= 0 && x < 8 && y >= 0 && y < 8) {
      const idx = y * 8 + x;
      const newTiles = [...tiles];
      const newActive = [...newTiles[activeTileIdx]];
      newActive[idx] = activeTool === 'eraser' ? 0 : selectedColorIdx;
      newTiles[activeTileIdx] = newActive;
      setTiles(newTiles);
      onDataChanged();
    }
  };

  const handlePaletteColorChange = (r5Val: number, g5Val: number, b5Val: number) => {
    const newBgr = (r5Val & 0x1f) | ((g5Val & 0x1f) << 5) | ((b5Val & 0x1f) << 10);
    const newColor = bgr555ToRgba(newBgr, selectedColorIdx === 0);
    const newPalette = [...palette];
    newPalette[selectedColorIdx] = newColor;
    setPalette(newPalette);
    onDataChanged();
  };

  const handleHexInput = (hex: string) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const rgb = hexToRgb(hex);
      const bgr = rgbToBgr555(rgb.r, rgb.g, rgb.b);
      const newColor = bgr555ToRgba(bgr, selectedColorIdx === 0);
      const newPalette = [...palette];
      newPalette[selectedColorIdx] = newColor;
      setPalette(newPalette);
      onDataChanged();
    }
  };

  const handleFlipH = () => {
    const newTiles = [...tiles];
    const current = [...newTiles[activeTileIdx]];
    const flipped = new Array(64);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        flipped[y * 8 + x] = current[y * 8 + (7 - x)];
      }
    }
    newTiles[activeTileIdx] = flipped;
    setTiles(newTiles);
    onDataChanged();
  };

  const handleFlipV = () => {
    const newTiles = [...tiles];
    const current = [...newTiles[activeTileIdx]];
    const flipped = new Array(64);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        flipped[y * 8 + x] = current[(7 - y) * 8 + x];
      }
    }
    newTiles[activeTileIdx] = flipped;
    setTiles(newTiles);
    onDataChanged();
  };

  const handleImageImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((res) => (img.onload = res));

    // Draw to temp canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 8;
    tempCanvas.height = 8;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 8, 8);
    const imgData = ctx.getImageData(0, 0, 8, 8);

    // Quantize to 16 colors
    const quantized = quantizeTo16Colors(imgData);
    setPalette(quantized.palette);
    const newTiles = [...tiles];
    newTiles[activeTileIdx] = quantized.indexedPixels;
    setTiles(newTiles);
    onDataChanged();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#080c14] text-slate-200">
      {/* Top Bar for Graphics Studio */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#0d1322] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <PaletteIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            4BPP Tileset & 15-Bit BGR Palette Studio
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleImageImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 rounded-md transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import PNG (4BPP Quantize)</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tilesheet Gallery */}
        <div className="w-64 bg-[#0a0f1c] border-r border-slate-800 p-4 flex flex-col shrink-0 overflow-y-auto">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">
            Tilesheet Gallery (16 Tiles)
          </label>

          <div className="grid grid-cols-4 gap-2.5">
            {tiles.map((tPixels, idx) => {
              const isSelected = idx === activeTileIdx;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveTileIdx(idx)}
                  className={`aspect-square rounded p-1 border transition-all ${
                    isSelected
                      ? 'border-emerald-400 ring-2 ring-emerald-500/30 bg-emerald-950/30'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="w-full h-full grid grid-cols-8 grid-rows-8 gap-0 rounded overflow-hidden">
                    {tPixels.map((p, pIdx) => {
                      const col = palette[p] || palette[0];
                      return (
                        <div
                          key={pIdx}
                          style={{ backgroundColor: p === 0 && col.a === 0 ? '#111' : rgbaToHex(col) }}
                        />
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-1 font-mono">
            <div>Format: 4BPP Indexed (16 colors)</div>
            <div>Tile Size: 8×8 Pixels (32 Bytes)</div>
          </div>
        </div>

        {/* Center: 8x8 Zoomed Pixel Editor */}
        <div className="flex-1 bg-[#05080f] flex flex-col items-center justify-center p-8 relative">
          <div className="mb-4 flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-lg">
            <button
              onClick={() => setActiveTool('pencil')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
                activeTool === 'pencil'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Pencil</span>
            </button>

            <button
              onClick={() => setActiveTool('eraser')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
                activeTool === 'eraser'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Eraser</span>
            </button>

            <div className="w-px h-4 bg-slate-800 mx-1" />

            <button
              onClick={handleFlipH}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded"
              title="Flip Horizontal"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleFlipV}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded"
              title="Flip Vertical"
            >
              <FlipVertical className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowGrid((g) => !g)}
              className={`p-1.5 rounded transition-colors ${
                showGrid ? 'text-emerald-400' : 'text-slate-500'
              }`}
              title="Toggle Grid"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>

          <canvas
            ref={pixelCanvasRef}
            onMouseDown={(e) => {
              isMouseDownRef.current = true;
              paintPixel(e);
            }}
            onMouseMove={(e) => {
              if (isMouseDownRef.current) paintPixel(e);
            }}
            onMouseUp={() => (isMouseDownRef.current = false)}
            onMouseLeave={() => (isMouseDownRef.current = false)}
            className="cursor-crosshair shadow-2xl rounded border border-slate-700/80 bg-[#000]"
          />

          <span className="text-[11px] font-mono text-slate-500 mt-3">
            Active Tile #{activeTileIdx} · Click and drag to draw
          </span>
        </div>

        {/* Right: 15-Bit BGR555 Palette Inspector */}
        <div className="w-80 bg-[#0a0f1c] border-l border-slate-800 p-5 flex flex-col shrink-0 overflow-y-auto space-y-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              16-Color Palette Swatches
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {palette.map((col, idx) => {
                const isSelected = idx === selectedColorIdx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedColorIdx(idx)}
                    className={`relative aspect-square rounded border transition-all ${
                      isSelected
                        ? 'border-emerald-400 ring-2 ring-emerald-500/40 scale-105 shadow-md'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                    style={{ backgroundColor: idx === 0 && col.a === 0 ? '#111' : rgbaToHex(col) }}
                  >
                    <span className="absolute bottom-0.5 right-1 text-[9px] font-mono font-bold text-white drop-shadow">
                      {idx}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Channel Sliders (5-bit GBA format) */}
          <div className="p-4 bg-[#0d1322] border border-slate-800 rounded-xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300">Color #{selectedColorIdx} Settings</span>
              <span className="font-mono text-emerald-400">
                0x{bgr555.toString(16).padStart(4, '0').toUpperCase()}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Red (5-Bit: 0..31)</span>
                  <span className="font-mono">{r5}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="31"
                  value={r5}
                  onChange={(e) => handlePaletteColorChange(parseInt(e.target.value), g5, b5)}
                  className="w-full accent-red-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Green (5-Bit: 0..31)</span>
                  <span className="font-mono">{g5}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="31"
                  value={g5}
                  onChange={(e) => handlePaletteColorChange(r5, parseInt(e.target.value), b5)}
                  className="w-full accent-green-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Blue (5-Bit: 0..31)</span>
                  <span className="font-mono">{b5}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="31"
                  value={b5}
                  onChange={(e) => handlePaletteColorChange(r5, g5, parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="text-slate-400 block mb-1">Hex Color Code</label>
                <input
                  type="text"
                  value={rgbaToHex(activeColor)}
                  onChange={(e) => handleHexInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-emerald-400 uppercase text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
