/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Pokémon Emerald (US) Memory Map and Standard Pointers
export const GBA_ROM_BASE = 0x08000000;
export const GBA_ROM_SIZE = 16 * 1024 * 1024; // 16,777,216 bytes (16MB)

// Header Signatures
export const EMERALD_GAME_CODE = 'BPEE';
export const EMERALD_GAME_TITLE = 'POKEMON EMER';
export const EMERALD_HEADER_CHECKSUM_OFFSET = 0xbd;
export const EMERALD_TITLE_OFFSET = 0xa0;
export const EMERALD_CODE_OFFSET = 0xac;

// Clean Pokémon Emerald (US) known CRC32 hashes
export const CLEAN_EMERALD_CRC32_LIST = [
  0x1f3798d5, // Emerald (USA, Europe)
  0x605b89b5, // Alternative release / dump
  0xf3ae0888, // Trashman dump
];

// Physical ROM Offsets (Calculated as GBAPointer - 0x08000000 for Emerald US BPEE)
export const OFFSETS = {
  // Pokémon Data Tables
  BASE_STATS_TABLE: 0x3203cc, // 28 bytes per entry, index 0 through 411+
  BASE_STATS_ENTRY_SIZE: 28,

  EVOLUTION_TABLE: 0x32531c,    // 40 bytes per species (5 entries of 8 bytes)
  EVOLUTION_ENTRY_SIZE: 40,
  MOVESET_TABLE_PTR: 0x32937c,  // 4 bytes per species pointer
  POKEMON_NAMES_TABLE: 0x3185c8,// 11 bytes per string, padded with 0xFF
  POKEMON_NAME_SIZE: 11,

  // Sprites & Graphics Pointers (Front sprite and palette tables in Emerald)
  FRONT_SPRITES_PTR_TABLE: 0x301418, // 8 bytes per entry: ptr + tag
  FRONT_SPRITE_SIZE: 2048,           // 64x64 4BPP = 2048 bytes uncompressed
  NORMAL_PALETTES_TABLE: 0x303678,   // 8 bytes per entry: ptr + tag
  SHINY_PALETTES_TABLE: 0x304358,    // 8 bytes per entry: ptr + tag

  // Items & Economy
  ITEM_DATA_TABLE: 0x5839a0, // 44 bytes per item
  ITEM_DATA_ENTRY_SIZE: 44,
  ITEM_NAME_SIZE: 14,

  // Map System
  MAP_BANKS_PTR: 0x486578,
  MAP_HEADER_SIZE: 20,
};

// Convert GBA pointer (e.g. 0x08254784) to physical file offset (0x254784)
export function gbaPointerToOffset(ptr: number): number {
  if (ptr >= GBA_ROM_BASE && ptr < GBA_ROM_BASE + GBA_ROM_SIZE) {
    return ptr - GBA_ROM_BASE;
  }
  return ptr;
}

// Convert physical file offset (0x254784) to GBA pointer (0x08254784)
export function offsetToGbaPointer(offset: number): number {
  return offset + GBA_ROM_BASE;
}
