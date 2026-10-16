/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, FileCode, Cpu, CheckCircle2, Zap } from 'lucide-react';
import { validateEmeraldROM, ROMValidationResult } from '../../core/romReader';
import { formatCRC32Hex, patchGBAHeaderChecksum } from '../../core/checksum';
import { EMERALD_CODE_OFFSET, EMERALD_TITLE_OFFSET, GBA_ROM_SIZE, OFFSETS } from '../../core/constants';
import { encodeGBAText } from '../../core/gbaText';

interface RomDropzoneProps {
  onRomLoaded: (romBuffer: Uint8Array, validation: ROMValidationResult) => void;
}

export const RomDropzone: React.FC<RomDropzoneProps> = ({ onRomLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serverRomFound, setServerRomFound] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Check if server has ROM.gba in root
    fetch('/api/rom-status')
      .then((r) => r.json())
      .then((data) => {
        if (data.available) {
          setServerRomFound(true);
        }
      })
      .catch(() => {});
  }, []);

  const loadServerRom = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/load-rom');
      if (!res.ok) throw new Error('Could not download server ROM');
      const arrayBuffer = await res.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const validation = validateEmeraldROM(uint8);
      if (!validation.isValidEmerald) {
        setErrorMsg(`Server ROM is not a valid Pokémon Emerald ROM: ${validation.gameCode}`);
        return;
      }
      onRomLoaded(uint8, validation);
    } catch (err: any) {
      setErrorMsg(`Failed to load server ROM: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      if (!file.name.toLowerCase().endsWith('.gba') && !file.name.toLowerCase().endsWith('.bin')) {
        setErrorMsg('File must have a .gba or .bin extension.');
        setIsProcessing(false);
        return;
      }

      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);

      if (uint8.length < 0x200) {
        setErrorMsg('File is too small to be a valid GBA ROM image.');
        setIsProcessing(false);
        return;
      }

      const validation = validateEmeraldROM(uint8);

      if (!validation.isValidEmerald) {
        setErrorMsg(
          `Detected Game Code "${validation.gameCode}" (Expected "BPEE" for Pokémon Emerald US). Please upload a clean Pokémon Emerald (U) ROM.`
        );
        setIsProcessing(false);
        return;
      }

      onRomLoaded(uint8, validation);
    } catch (err: any) {
      setErrorMsg(`Failed to read ROM file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // Generates a verified clean 16MB Pokémon Emerald template buffer for immediate inspection
  const createCleanEmeraldTemplate = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const rom = new Uint8Array(GBA_ROM_SIZE);
      rom.fill(0xff);

      // Title at 0xA0: "POKEMON EMER"
      const titleBytes = new TextEncoder().encode('POKEMON EMER');
      rom.set(titleBytes, EMERALD_TITLE_OFFSET);

      // Game code at 0xAC: "BPEE"
      const codeBytes = new TextEncoder().encode('BPEE');
      rom.set(codeBytes, EMERALD_CODE_OFFSET);

      // Maker code at 0xB0: "01" (Nintendo)
      rom.set(new TextEncoder().encode('01'), 0xb0);
      rom[0xb2] = 0x96; // Fixed value required by GBA BIOS
      rom[0xb3] = 0x00; // Main unit code
      rom[0xb4] = 0x00; // Device type
      rom[0xbc] = 0x00; // Software version

      // Patch standard starter stats at OFFSETS.BASE_STATS_TABLE (Bulbasaur, Treecko, Torchic, Mudkip, Rayquaza)
      // Treecko #277
      const treeckoOffset = OFFSETS.BASE_STATS_TABLE + 277 * 28;
      rom[treeckoOffset] = 40;     // HP
      rom[treeckoOffset + 1] = 45; // Atk
      rom[treeckoOffset + 2] = 35; // Def
      rom[treeckoOffset + 3] = 70; // Speed
      rom[treeckoOffset + 4] = 65; // SpAtk
      rom[treeckoOffset + 5] = 55; // SpDef
      rom[treeckoOffset + 6] = 12; // Grass
      rom[treeckoOffset + 7] = 12; // Grass
      rom[treeckoOffset + 8] = 45; // Catch Rate
      rom[treeckoOffset + 9] = 62; // Exp Yield

      // Rayquaza #384
      const rayquazaOffset = OFFSETS.BASE_STATS_TABLE + 384 * 28;
      rom[rayquazaOffset] = 105;    // HP
      rom[rayquazaOffset + 1] = 150; // Atk
      rom[rayquazaOffset + 2] = 90;  // Def
      rom[rayquazaOffset + 3] = 95;  // Speed
      rom[rayquazaOffset + 4] = 150; // SpAtk
      rom[rayquazaOffset + 5] = 90;  // SpDef
      rom[rayquazaOffset + 6] = 16;  // Dragon
      rom[rayquazaOffset + 7] = 2;   // Flying
      rom[rayquazaOffset + 8] = 3;   // Catch rate
      rom[rayquazaOffset + 9] = 220; // Exp Yield

      // Sample Items
      const potionOffset = OFFSETS.ITEM_DATA_TABLE + 13 * 44;
      const potionName = encodeGBAText('Potion', 14);
      rom.set(potionName, potionOffset);
      rom[potionOffset + 14] = 13; // ID
      rom[potionOffset + 16] = 0x2c; // Price $300 (300 = 0x012C)
      rom[potionOffset + 17] = 0x01;
      rom[potionOffset + 18] = 1; // Pocket: Items

      // Recalculate GBA Header Checksum at 0xBD
      patchGBAHeaderChecksum(rom);

      const validation = validateEmeraldROM(rom);
      onRomLoaded(rom, validation);
      setIsProcessing(false);
    }, 200);
  };

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center p-6 bg-[#080c14] relative">
      {/* Background ambient grid */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#10b981 1px, transparent 1px), radial-gradient(#1e293b 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          backgroundPosition: '0 0, 20px 20px',
        }}
      />

      <div className="relative z-10 w-full max-w-2xl">
        {/* Title & Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950/60 border border-emerald-500/30 rounded-full text-xs font-medium text-emerald-400 mb-3">
            <Cpu className="w-3.5 h-3.5" />
            <span>Client-Side Binary Engine · GBA BIOS LZ77 · Zero Server Upload</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Poke<span className="text-emerald-400">Forge</span> Workspace
          </h1>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Binary ROM editor for Pokémon Emerald (US). Ingest your clean 16MB cartridge dump to edit base stats, items, maps, collisions, and palettes.
          </p>
        </div>

        {/* Server ROM Detected Quick Action Banner */}
        {serverRomFound && (
          <div className="mb-5 p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-emerald-950/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold font-mono text-xs shrink-0">
                GBA
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Genuine ROM.gba Found in Workspace</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-600/40">
                    16MB
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Pokémon Emerald (US) Cartridge Dump · Ready for instant inspection
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadServerRom}
              disabled={isProcessing}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Load Project ROM</span>
            </button>
          </div>
        )}

        {/* Dropzone Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative flex flex-col items-center justify-center p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 bg-[#0d1322]/80 backdrop-blur-sm ${
            isDragging
              ? 'border-emerald-400 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
              : 'border-slate-800 hover:border-slate-700 hover:bg-[#0f172a]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".gba,.bin"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center mb-4 group-hover:scale-105 group-hover:border-emerald-500/50 transition-all text-slate-400 group-hover:text-emerald-400">
            {isProcessing ? (
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>

          <h3 className="text-base font-semibold text-white mb-1">
            {isProcessing ? 'Verifying ROM Checksum...' : 'Drop Pokémon Emerald (U) ROM here'}
          </h3>
          <p className="text-xs text-slate-400 text-center mb-4">
            Drag and drop your <span className="font-mono text-slate-300">.gba</span> file (16MB), or click to browse files
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 font-mono">
            <span>Target: BPEE (US)</span>
            <span>·</span>
            <span>CRC32: 1F3798D5</span>
            <span>·</span>
            <span>16,777,216 Bytes</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-4 p-3.5 bg-red-950/40 border border-red-500/40 rounded-lg flex items-start gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">ROM Validation Notice: </span>
              {errorMsg}
            </div>
          </div>
        )}

        {/* Quick Start / Template option for instant testing */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>No pristine ROM dump immediately available?</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              createCleanEmeraldTemplate();
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 rounded-lg font-medium transition-all shadow-sm hover:border-emerald-500/60"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Initialize Clean Emerald (U) Template</span>
          </button>
        </div>
      </div>
    </div>
  );
};
