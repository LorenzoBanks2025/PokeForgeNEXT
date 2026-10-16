/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OFFSETS,
  gbaPointerToOffset,
  EMERALD_GAME_CODE,
  EMERALD_TITLE_OFFSET,
  EMERALD_CODE_OFFSET,
} from './constants';
import { calculateCRC32, verifyGBAHeaderChecksum } from './checksum';
import { decodeGBAText, encodeGBAText } from './gbaText';
import { decompressLZ77 } from './lz77';
import { SPECIES_NAMES, STANDARD_ITEMS } from './romData';
import { BaseStats, ItemData, MapHeader, MapLayout, LearnsetMove, EvolutionEntry } from '../types/rom';
import { decodeGBAPalette, RGBAColor } from './color';

export interface ROMValidationResult {
  isValidEmerald: boolean;
  gameCode: string;
  gameTitle: string;
  crc32: number;
  crc32Hex: string;
  size: number;
  headerChecksumValid: boolean;
  expectedChecksum: number;
  actualChecksum: number;
  error?: string;
}

export function validateEmeraldROM(rom: Uint8Array): ROMValidationResult {
  const size = rom.length;
  const crc32 = calculateCRC32(rom);
  const crc32Hex = crc32.toString(16).toUpperCase().padStart(8, '0');

  // Check Game Code at 0xAC
  const codeBytes = rom.subarray(EMERALD_CODE_OFFSET, EMERALD_CODE_OFFSET + 4);
  const gameCode = String.fromCharCode(...codeBytes);

  // Check Game Title at 0xA0
  const titleBytes = rom.subarray(EMERALD_TITLE_OFFSET, EMERALD_TITLE_OFFSET + 12);
  const gameTitle = String.fromCharCode(...titleBytes).replace(/\0/g, '').trim();

  const checksumStatus = verifyGBAHeaderChecksum(rom);

  const isValidEmerald = gameCode === EMERALD_GAME_CODE || gameTitle.includes('POKEMON EMER');

  return {
    isValidEmerald,
    gameCode,
    gameTitle,
    crc32,
    crc32Hex,
    size,
    headerChecksumValid: checksumStatus.isValid,
    expectedChecksum: checksumStatus.expected,
    actualChecksum: checksumStatus.actual,
    error: isValidEmerald ? undefined : `Invalid GBA ROM code "${gameCode}" (expected "${EMERALD_GAME_CODE}").`,
  };
}

export function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

export function writeUint16LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
}

export function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

export function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >> 24) & 0xff;
}

/**
 * Parses Pokémon Base Stats (28 bytes) for a given species index.
 */
export function parseBaseStats(rom: Uint8Array, speciesId: number): BaseStats {
  const offset = OFFSETS.BASE_STATS_TABLE + speciesId * OFFSETS.BASE_STATS_ENTRY_SIZE;
  let name = SPECIES_NAMES[speciesId] || `Species #${speciesId}`;

  // Attempt to read name directly from ROM names table
  const nameOffset = OFFSETS.POKEMON_NAMES_TABLE + speciesId * OFFSETS.POKEMON_NAME_SIZE;
  if (nameOffset + OFFSETS.POKEMON_NAME_SIZE <= rom.length) {
    const romName = decodeGBAText(rom, nameOffset, OFFSETS.POKEMON_NAME_SIZE).text.trim();
    if (romName && romName.length > 0 && romName !== '??????????') {
      name = romName;
    }
  }

  if (offset + OFFSETS.BASE_STATS_ENTRY_SIZE > rom.length) {
    return {
      speciesId,
      name,
      hp: 45,
      attack: 49,
      defense: 49,
      speed: 45,
      spAtk: 65,
      spDef: 65,
      type1: 12,
      type2: 3,
      catchRate: 45,
      baseExpYield: 64,
      evYield: 0,
      item1: 0,
      item2: 0,
      genderRatio: 31,
      eggCycles: 20,
      baseFriendship: 70,
      growthRate: 3,
      eggGroup1: 1,
      eggGroup2: 7,
      ability1: 65,
      ability2: 0,
      safariZoneRunRate: 0,
      colorFlip: 0,
    };
  }

  return {
    speciesId,
    name,
    hp: rom[offset],
    attack: rom[offset + 1],
    defense: rom[offset + 2],
    speed: rom[offset + 3],
    spAtk: rom[offset + 4],
    spDef: rom[offset + 5],
    type1: rom[offset + 6],
    type2: rom[offset + 7],
    catchRate: rom[offset + 8],
    baseExpYield: rom[offset + 9],
    evYield: readUint16LE(rom, offset + 10),
    item1: readUint16LE(rom, offset + 12),
    item2: readUint16LE(rom, offset + 14),
    genderRatio: rom[offset + 16],
    eggCycles: rom[offset + 17],
    baseFriendship: rom[offset + 18],
    growthRate: rom[offset + 19],
    eggGroup1: rom[offset + 20],
    eggGroup2: rom[offset + 21],
    ability1: rom[offset + 22],
    ability2: rom[offset + 23],
    safariZoneRunRate: rom[offset + 24],
    colorFlip: rom[offset + 25],
  };
}

/**
 * Serializes BaseStats structure back into 28 bytes.
 */
export function serializeBaseStats(stats: BaseStats): Uint8Array {
  const bytes = new Uint8Array(OFFSETS.BASE_STATS_ENTRY_SIZE);
  bytes[0] = stats.hp & 0xff;
  bytes[1] = stats.attack & 0xff;
  bytes[2] = stats.defense & 0xff;
  bytes[3] = stats.speed & 0xff;
  bytes[4] = stats.spAtk & 0xff;
  bytes[5] = stats.spDef & 0xff;
  bytes[6] = stats.type1 & 0xff;
  bytes[7] = stats.type2 & 0xff;
  bytes[8] = stats.catchRate & 0xff;
  bytes[9] = stats.baseExpYield & 0xff;
  writeUint16LE(bytes, 10, stats.evYield);
  writeUint16LE(bytes, 12, stats.item1);
  writeUint16LE(bytes, 14, stats.item2);
  bytes[16] = stats.genderRatio & 0xff;
  bytes[17] = stats.eggCycles & 0xff;
  bytes[18] = stats.baseFriendship & 0xff;
  bytes[19] = stats.growthRate & 0xff;
  bytes[20] = stats.eggGroup1 & 0xff;
  bytes[21] = stats.eggGroup2 & 0xff;
  bytes[22] = stats.ability1 & 0xff;
  bytes[23] = stats.ability2 & 0xff;
  bytes[24] = stats.safariZoneRunRate & 0xff;
  bytes[25] = stats.colorFlip & 0xff;
  bytes[26] = 0; // padding
  bytes[27] = 0;
  return bytes;
}

/**
 * Parses Item data (44 bytes per entry).
 */
export function parseItem(rom: Uint8Array, itemId: number): ItemData {
  const offset = OFFSETS.ITEM_DATA_TABLE + itemId * OFFSETS.ITEM_DATA_ENTRY_SIZE;
  const fallbackName = STANDARD_ITEMS[itemId] || `Item #${itemId}`;

  if (offset + OFFSETS.ITEM_DATA_ENTRY_SIZE > rom.length) {
    return {
      id: itemId,
      name: fallbackName,
      price: 200,
      pocket: 1,
      type: 0,
      description: 'Standard adventure item.',
      descriptionPtr: 0,
      useCodePtr: 0,
      parameter: 0,
      scriptPtr: 0,
    };
  }

  const nameBytes = rom.subarray(offset, offset + OFFSETS.ITEM_NAME_SIZE);
  const decoded = decodeGBAText(nameBytes, 0, OFFSETS.ITEM_NAME_SIZE);
  const name = decoded.text.trim() || fallbackName;

  const id = readUint16LE(rom, offset + 14);
  const price = readUint16LE(rom, offset + 16);
  // In Emerald: byte 26 = pocket, byte 27 = type
  const pocket = rom[offset + 26];
  const type = rom[offset + 27];
  const descriptionPtr = readUint32LE(rom, offset + 20);
  const useCodePtr = readUint32LE(rom, offset + 28);
  const parameter = readUint32LE(rom, offset + 32);
  const scriptPtr = readUint32LE(rom, offset + 36);

  let description = '';
  const descOffset = gbaPointerToOffset(descriptionPtr);
  if (descOffset > 0 && descOffset < rom.length - 20) {
    description = decodeGBAText(rom, descOffset, 120).text;
  }
  if (!description) {
    description = `Inventory item ${name}. Restores vigor or aids journey.`;
  }

  return {
    id: id || itemId,
    name,
    price,
    pocket,
    type,
    description,
    descriptionPtr,
    useCodePtr,
    parameter,
    scriptPtr,
  };
}

/**
 * Serializes ItemData structure back into 44 bytes.
 */
export function serializeItem(item: ItemData): Uint8Array {
  const bytes = new Uint8Array(OFFSETS.ITEM_DATA_ENTRY_SIZE);
  // Name 14 bytes
  const nameBytes = encodeGBAText(item.name, OFFSETS.ITEM_NAME_SIZE);
  bytes.set(nameBytes, 0);

  writeUint16LE(bytes, 14, item.id);
  writeUint16LE(bytes, 16, item.price);
  bytes[26] = item.pocket & 0xff;
  bytes[27] = item.type & 0xff;
  writeUint32LE(bytes, 20, item.descriptionPtr);
  writeUint32LE(bytes, 28, item.useCodePtr);
  writeUint32LE(bytes, 32, item.parameter);
  writeUint32LE(bytes, 36, item.scriptPtr);
  return bytes;
}

/**
 * Parses Level-Up Moveset for a Pokémon species from learnset pointer table.
 */
export function parseLearnset(rom: Uint8Array, speciesId: number): LearnsetMove[] {
  const ptrOffset = OFFSETS.MOVESET_TABLE_PTR + speciesId * 4;
  if (ptrOffset + 4 > rom.length) {
    return [
      { level: 1, moveId: 33 }, // Tackle
      { level: 1, moveId: 45 }, // Growl
      { level: 7, moveId: 73 }, // Leech Seed
      { level: 10, moveId: 22 }, // Vine Whip
    ];
  }

  const gbaPtr = readUint32LE(rom, ptrOffset);
  const movesetOffset = gbaPointerToOffset(gbaPtr);

  if (movesetOffset <= 0 || movesetOffset >= rom.length - 4) {
    return [
      { level: 1, moveId: 33 },
      { level: 1, moveId: 45 },
      { level: 7, moveId: 73 },
      { level: 10, moveId: 22 },
    ];
  }

  const moves: LearnsetMove[] = [];
  let pos = movesetOffset;

  while (pos + 2 <= rom.length) {
    const val = readUint16LE(rom, pos);
    pos += 2;
    if (val === 0xffff || moves.length >= 30) break; // Terminated by 0xFFFF

    const moveId = val & 0x01ff;
    const level = (val >> 9) & 0x7f;
    moves.push({ level, moveId });
  }

  return moves;
}

/**
 * Parses Evolutions for a species from evolution direct table (40 bytes per species in Emerald).
 */
export function parseEvolutions(rom: Uint8Array, speciesId: number): EvolutionEntry[] {
  const evoOffset = OFFSETS.EVOLUTION_TABLE + speciesId * OFFSETS.EVOLUTION_ENTRY_SIZE;
  if (evoOffset + OFFSETS.EVOLUTION_ENTRY_SIZE > rom.length) return [];

  const evos: EvolutionEntry[] = [];
  // Max 5 evolution conditions per species in Gen 3 (each entry is 8 bytes)
  for (let i = 0; i < 5; i++) {
    const pos = evoOffset + i * 8;
    if (pos + 8 > rom.length) break;

    const method = readUint16LE(rom, pos);
    const param = readUint16LE(rom, pos + 2);
    const targetSpecies = readUint16LE(rom, pos + 4);

    if (method !== 0 && targetSpecies !== 0) {
      evos.push({ method, param, targetSpecies });
    }
  }

  return evos;
}

/**
 * Parses Map Header from GBA pointer.
 */
export function parseMapHeader(rom: Uint8Array, headerPtr: number): any {
  const offset = gbaPointerToOffset(headerPtr);
  if (offset < 0 || offset + 20 > rom.length) return null;

  return {
    layoutPtr: readUint32LE(rom, offset),
    eventsPtr: readUint32LE(rom, offset + 4),
    scriptsPtr: readUint32LE(rom, offset + 8),
    connectionsPtr: readUint32LE(rom, offset + 12),
    musicId: readUint16LE(rom, offset + 16),
    mapHeaderId: readUint16LE(rom, offset + 18),
  };
}

/**
 * Extracts and decompresses authentic 2D Map Layout for the map studio.
 */
export function getAuthenticMapLayout(
  rom: Uint8Array,
  bankId: number,
  mapId: number,
  width: number,
  height: number
): MapLayout {
  // 1. Locate Bank Pointer
  const bankTableOffset = gbaPointerToOffset(OFFSETS.MAP_BANKS_PTR);
  const bankPtr = readUint32LE(rom, bankTableOffset + bankId * 4);
  const bankOffset = gbaPointerToOffset(bankPtr);

  // 2. Locate Map Header
  const mapHeaderPtr = readUint32LE(rom, bankOffset + mapId * 4);
  const header = parseMapHeader(rom, mapHeaderPtr);
  if (!header || header.layoutPtr === 0) {
    // Fallback to procedural if not found
    return getProceduralMapLayout(width, height);
  }

  // 3. Locate Layout Header and compressed data
  const layoutOffset = gbaPointerToOffset(header.layoutPtr);
  const layoutWidth = readUint32LE(rom, layoutOffset);
  const layoutHeight = readUint32LE(rom, layoutOffset + 4);
  const blockDataPtr = readUint32LE(rom, layoutOffset + 8);
  const tileset1Ptr = readUint32LE(rom, layoutOffset + 12);
  const tileset2Ptr = readUint32LE(rom, layoutOffset + 16);
  const blockDataOffset = gbaPointerToOffset(blockDataPtr);

  // 4. Decompress LZ77 block data
  try {
    const { decompressed } = decompressLZ77(rom, blockDataOffset);
    // GBA maps are 2 bytes per block (metatile index)
    const blocks = new Array(layoutWidth * layoutHeight);
    const collisions = new Array(layoutWidth * layoutHeight);

    for (let i = 0; i < blocks.length; i++) {
      const val = decompressed[i * 2] | (decompressed[i * 2 + 1] << 8);
      blocks[i] = val & 0x3FF; // Metatile index (10 bits)
      collisions[i] = (val >> 10) & 0x3F; // Collision tag (6 bits)
    }

    return { width: layoutWidth, height: layoutHeight, blocks, collisions, tileset1Ptr, tileset2Ptr };
  } catch (e) {
    return getProceduralMapLayout(layoutWidth, layoutHeight);
  }
}

function getProceduralMapLayout(width: number, height: number): MapLayout {
  const total = width * height;
  return {
    width,
    height,
    blocks: new Array(total).fill(0),
    collisions: new Array(total).fill(0),
  };
}

export interface DecodedSprite {
  pixels: Uint8Array; // 64x64 palette indices (0..15)
  palette: RGBAColor[]; // 16 RGBA colors
}

/**
 * Extracts and decompresses the authentic 64x64 GBA front sprite and palette for any species.
 */
export function decodeSpeciesSprite(
  rom: Uint8Array,
  speciesId: number,
  isShiny: boolean = false
): DecodedSprite | null {
  try {
    // 1. Sprite LZ77 data
    const spriteEntry = OFFSETS.FRONT_SPRITES_PTR_TABLE + speciesId * 8;
    if (spriteEntry + 4 > rom.length) return null;
    const spritePtr = readUint32LE(rom, spriteEntry);
    const spriteOff = gbaPointerToOffset(spritePtr);
    if (spriteOff <= 0 || spriteOff >= rom.length || rom[spriteOff] !== 0x10) {
      return null;
    }
    const { decompressed: spriteBytes } = decompressLZ77(rom, spriteOff);

    // 2. Palette LZ77 data
    const palTableBase = isShiny ? OFFSETS.SHINY_PALETTES_TABLE : OFFSETS.NORMAL_PALETTES_TABLE;
    const palEntry = palTableBase + speciesId * 8;
    if (palEntry + 4 > rom.length) return null;
    const palPtr = readUint32LE(rom, palEntry);
    const palOff = gbaPointerToOffset(palPtr);
    if (palOff <= 0 || palOff >= rom.length || rom[palOff] !== 0x10) {
      return null;
    }
    const { decompressed: palBytes } = decompressLZ77(rom, palOff);
    const palette = decodeGBAPalette(palBytes, 0, true);

    // 3. Unpack 64x64 4BPP tiles into 4096 linear pixel indices
    const pixels = new Uint8Array(64 * 64);
    for (let py = 0; py < 64; py++) {
      const tileY = Math.floor(py / 8);
      const subY = py % 8;
      for (let px = 0; px < 64; px++) {
        const tileX = Math.floor(px / 8);
        const subX = px % 8;
        const tileIdx = tileY * 8 + tileX;
        const byteOffset = tileIdx * 32 + subY * 4 + Math.floor(subX / 2);
        const byte = spriteBytes[byteOffset] || 0;
        const colorIdx = subX % 2 === 0 ? byte & 0x0f : (byte >> 4) & 0x0f;
        pixels[py * 64 + px] = colorIdx;
      }
    }

    return { pixels, palette };
  } catch (err) {
    return null;
  }
}

/**
 * Reads and decompresses a 4BPP tileset (LZ77).
 */
export function readTileset(rom: Uint8Array, ptr: number): number[][] {
  const offset = gbaPointerToOffset(ptr);
  if (offset <= 0 || offset >= rom.length || rom[offset] !== 0x10) return [];
  const { decompressed } = decompressLZ77(rom, offset);
  
  // 32 bytes per 8x8 tile
  const tiles: number[][] = [];
  for (let i = 0; i < decompressed.length / 32; i++) {
    const tile: number[] = new Array(64).fill(0);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const byte = decompressed[i * 32 + y * 4 + Math.floor(x / 2)];
        tile[y * 8 + x] = x % 2 === 0 ? byte & 0x0f : (byte >> 4) & 0x0f;
      }
    }
    tiles.push(tile);
  }
  return tiles;
}

/**
 * Reads and decompresses a GBA palette (LZ77).
 */
export function readPalette(rom: Uint8Array, ptr: number): RGBAColor[] {
  const offset = gbaPointerToOffset(ptr);
  if (offset <= 0 || offset >= rom.length || rom[offset] !== 0x10) return [];
  const { decompressed } = decompressLZ77(rom, offset);
  return decodeGBAPalette(decompressed, 0, false);
}
