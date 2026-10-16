/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import {
  validateEmeraldROM,
  parseBaseStats,
  parseItem,
  parseLearnset,
  parseEvolutions,
  decodeSpeciesSprite,
  getMapLayout,
} from '../src/core/romReader';
import {
  calculateCRC32,
  calculateGBAHeaderChecksum,
  verifyGBAHeaderChecksum,
  formatCRC32Hex,
  patchGBAHeaderChecksum,
} from '../src/core/checksum';
import { decompressLZ77, compressLZ77 } from '../src/core/lz77';
import { decodeGBAText, encodeGBAText } from '../src/core/gbaText';
import { DeltaManager } from '../src/core/deltaManager';
import { OFFSETS, gbaPointerToOffset } from '../src/core/constants';
import {
  bgr555ToRgba,
  rgbToBgr555,
  decodeGBAPalette,
  encodeGBAPalette,
  rgbaToHex,
  hexToRgb,
  quantizeTo16Colors,
} from '../src/core/color';

const romPath = path.resolve(process.cwd(), 'ROM.gba');

async function runTests() {
  console.log('====================================================');
  console.log('PokeForge Comprehensive ROM Unit Test Suite');
  console.log('Target: Pokémon Emerald (US, BPEE)');
  console.log('====================================================\n');

  if (!fs.existsSync(romPath)) {
    console.error(`FAIL: ROM.gba not found at ${romPath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(romPath);
  const rom = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, details?: any) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      if (details) console.error('       Details:', details);
      failed++;
    }
  }

  // 1. Header & Cartridge Ingestion
  console.log('--- 1. Header & Cartridge Ingestion ---');
  assert(rom.length === 16777216, `ROM size is exactly 16MB (${rom.length} bytes)`, { size: rom.length });

  const validation = validateEmeraldROM(rom);
  assert(validation.isValidEmerald, 'validateEmeraldROM recognizes genuine Pokémon Emerald');
  assert(validation.gameCode === 'BPEE', `Game code is BPEE (got "${validation.gameCode}")`);
  assert(validation.gameTitle.startsWith('POKEMON EMER'), `Title starts with POKEMON EMER (got "${validation.gameTitle}")`);
  console.log(`       Computed CRC32: 0x${validation.crc32Hex}`);
  console.log(`       BIOS Checksum at 0xBD: 0x${rom[0xbd].toString(16).toUpperCase()} (Expected: 0x${validation.expectedChecksum.toString(16).toUpperCase()})`);
  assert(validation.headerChecksumValid, 'Header checksum at 0xBD matches Nintendo BIOS sum');

  // 2. Base Stats Table Parsing
  console.log('\n--- 2. Base Stats Table Parsing (0x3203CC) ---');
  // Bulbasaur #1
  const bulbasaur = parseBaseStats(rom, 1);
  assert(bulbasaur.hp === 45, 'Bulbasaur HP is 45', { hp: bulbasaur.hp });
  assert(bulbasaur.attack === 49, 'Bulbasaur Attack is 49', { attack: bulbasaur.attack });
  assert(bulbasaur.defense === 49, 'Bulbasaur Defense is 49', { defense: bulbasaur.defense });
  assert(bulbasaur.speed === 45, 'Bulbasaur Speed is 45', { speed: bulbasaur.speed });
  assert(bulbasaur.spAtk === 65, 'Bulbasaur Sp. Atk is 65', { spAtk: bulbasaur.spAtk });
  assert(bulbasaur.spDef === 65, 'Bulbasaur Sp. Def is 65', { spDef: bulbasaur.spDef });
  assert(bulbasaur.type1 === 12 && bulbasaur.type2 === 3, 'Bulbasaur is Grass (12) / Poison (3)');

  // Treecko #277
  const treecko = parseBaseStats(rom, 277);
  assert(treecko.hp === 40, 'Treecko HP is 40', { hp: treecko.hp });
  assert(treecko.attack === 45, 'Treecko Attack is 45', { attack: treecko.attack });
  assert(treecko.defense === 35, 'Treecko Defense is 35', { defense: treecko.defense });
  assert(treecko.speed === 70, 'Treecko Speed is 70', { speed: treecko.speed });
  assert(treecko.spAtk === 65, 'Treecko Sp. Atk is 65', { spAtk: treecko.spAtk });
  assert(treecko.spDef === 55, 'Treecko Sp. Def is 55', { spDef: treecko.spDef });

  // Torchic #280
  const torchic = parseBaseStats(rom, 280);
  assert(torchic.hp === 45, 'Torchic HP is 45', { hp: torchic.hp });
  assert(torchic.attack === 60, 'Torchic Attack is 60', { attack: torchic.attack });
  assert(torchic.type1 === 10, 'Torchic is Fire (10)', { type1: torchic.type1 });

  // Mudkip #283
  const mudkip = parseBaseStats(rom, 283);
  assert(mudkip.hp === 50, 'Mudkip HP is 50', { hp: mudkip.hp });
  assert(mudkip.attack === 70, 'Mudkip Attack is 70', { attack: mudkip.attack });
  assert(mudkip.type1 === 11, 'Mudkip is Water (11)', { type1: mudkip.type1 });

  // Rayquaza #406
  const rayquaza = parseBaseStats(rom, 406);
  assert(rayquaza.hp === 105, 'Rayquaza HP is 105', { hp: rayquaza.hp });
  assert(rayquaza.attack === 150, 'Rayquaza Attack is 150', { attack: rayquaza.attack });
  assert(rayquaza.defense === 90, 'Rayquaza Defense is 90', { defense: rayquaza.defense });
  assert(rayquaza.speed === 95, 'Rayquaza Speed is 95', { speed: rayquaza.speed });
  assert(rayquaza.spAtk === 150, 'Rayquaza Sp. Atk is 150', { spAtk: rayquaza.spAtk });
  assert(rayquaza.spDef === 90, 'Rayquaza Sp. Def is 90', { spDef: rayquaza.spDef });

  // 3. Pokémon Names Table Parsing (0x3185C8, 11 bytes per name)
  console.log('\n--- 3. Pokémon Names Table Parsing (0x3185C8) ---');
  function readRomSpeciesName(id: number): string {
    const offset = OFFSETS.POKEMON_NAMES_TABLE + id * OFFSETS.POKEMON_NAME_SIZE;
    return decodeGBAText(rom, offset, OFFSETS.POKEMON_NAME_SIZE).text.trim();
  }
  const name1 = readRomSpeciesName(1);
  assert(name1 === 'BULBASAUR', `Species #1 name in ROM is "BULBASAUR" (got "${name1}")`);
  const name25 = readRomSpeciesName(25);
  assert(name25 === 'PIKACHU', `Species #25 name in ROM is "PIKACHU" (got "${name25}")`);
  const name277 = readRomSpeciesName(277);
  assert(name277 === 'TREECKO', `Species #277 name in ROM is "TREECKO" (got "${name277}")`);
  const name280 = readRomSpeciesName(280);
  assert(name280 === 'TORCHIC', `Species #280 name in ROM is "TORCHIC" (got "${name280}")`);
  const name283 = readRomSpeciesName(283);
  assert(name283 === 'MUDKIP', `Species #283 name in ROM is "MUDKIP" (got "${name283}")`);
  const name406 = readRomSpeciesName(406);
  assert(name406 === 'RAYQUAZA', `Species #406 name in ROM is "RAYQUAZA" (got "${name406}")`);

  // 4. Items Table Parsing (0x5839A0, 44 bytes per item)
  console.log('\n--- 4. Items Table Parsing (0x5839A0) ---');
  const masterBall = parseItem(rom, 1);
  assert(masterBall.name === 'MASTER BALL', `Item #1 name is "MASTER BALL" (got "${masterBall.name}")`);
  assert(masterBall.price === 0, `Master Ball price is 0 (got ${masterBall.price})`);
  assert(masterBall.pocket === 2, `Master Ball is in Poké Balls pocket 2 (got ${masterBall.pocket})`);

  const ultraBall = parseItem(rom, 2);
  assert(ultraBall.name === 'ULTRA BALL', `Item #2 name is "ULTRA BALL" (got "${ultraBall.name}")`);
  assert(ultraBall.price === 1200, `Ultra Ball price is 1200 (got ${ultraBall.price})`);

  const potion = parseItem(rom, 13);
  assert(potion.name === 'POTION', `Item #13 name is "POTION" (got "${potion.name}")`);
  assert(potion.price === 300, `Potion price is 300 (got ${potion.price})`);
  assert(potion.pocket === 1, `Potion pocket is 1 (got ${potion.pocket})`);

  const rareCandy = parseItem(rom, 68);
  assert(rareCandy.name === 'RARE CANDY', `Item #68 name is "RARE CANDY" (got "${rareCandy.name}")`);
  assert(rareCandy.price === 4800, `Rare Candy price is 4800 (got ${rareCandy.price})`);

  // 5. Learnsets & Evolutions
  console.log('\n--- 5. Learnsets & Evolutions Pointers ---');
  const treeckoMoves = parseLearnset(rom, 277);
  assert(treeckoMoves.length > 0, `Parsed ${treeckoMoves.length} moves for Treecko learnset`);
  const treeckoLv1 = treeckoMoves.find((m) => m.level === 1);
  assert(!!treeckoLv1, 'Treecko has level 1 starting moves');

  const treeckoEvos = parseEvolutions(rom, 277);
  assert(treeckoEvos.length > 0, `Parsed ${treeckoEvos.length} evolution(s) for Treecko`);
  if (treeckoEvos.length > 0) {
    assert(treeckoEvos[0].targetSpecies === 278, `Treecko evolves into Grovyle #278 (got ${treeckoEvos[0].targetSpecies})`);
    assert(treeckoEvos[0].param === 16, `Treecko evolves at Level 16 (got ${treeckoEvos[0].param})`);
  }

  // 6. LZ77 Compression Engine
  console.log('\n--- 6. LZ77 Compression Engine ---');
  const spritePtr = rom[OFFSETS.FRONT_SPRITES_PTR_TABLE] |
    (rom[OFFSETS.FRONT_SPRITES_PTR_TABLE + 1] << 8) |
    (rom[OFFSETS.FRONT_SPRITES_PTR_TABLE + 2] << 16) |
    (rom[OFFSETS.FRONT_SPRITES_PTR_TABLE + 3] << 24);
  const spriteOffset = gbaPointerToOffset(spritePtr);

  if (spriteOffset > 0 && spriteOffset < rom.length && rom[spriteOffset] === 0x10) {
    const decompressed = decompressLZ77(rom, spriteOffset);
    assert(decompressed.decompressed.length === 2048, `Decompressed ${decompressed.decompressed.length} bytes (64x64 4BPP sprite) from ROM LZ77 block`);
    const recompressed = compressLZ77(decompressed.decompressed);
    assert(recompressed[0] === 0x10, 'Re-compressed stream has 0x10 magic header');
    const decompressedAgain = decompressLZ77(recompressed, 0);
    assert(
      Buffer.compare(Buffer.from(decompressed.decompressed), Buffer.from(decompressedAgain.decompressed)) === 0,
      'LZ77 Round-trip compression preserves 100% byte integrity'
    );
  }

  // 7. Authentic Sprite & Palette Extraction from ROM
  console.log('\n--- 7. Authentic Sprite & Palette Extraction ---');
  const bulbaSprite = decodeSpeciesSprite(rom, 1, false);
  assert(!!bulbaSprite, 'Bulbasaur front sprite extracted from ROM');
  if (bulbaSprite) {
    assert(bulbaSprite.pixels.length === 4096, `Bulbasaur has 64x64=4096 pixels (got ${bulbaSprite.pixels.length})`);
    assert(bulbaSprite.palette.length === 16, `Bulbasaur palette has 16 colors (got ${bulbaSprite.palette.length})`);
  }

  const shinyTreeckoSprite = decodeSpeciesSprite(rom, 277, true);
  assert(!!shinyTreeckoSprite, 'Shiny Treecko front sprite and shiny palette extracted from ROM');
  if (shinyTreeckoSprite) {
    assert(shinyTreeckoSprite.pixels.length === 4096, 'Shiny Treecko has 4096 pixels');
    assert(shinyTreeckoSprite.palette.length === 16, 'Shiny Treecko palette has 16 colors');
  }

  // 8. Color Conversions & Palette Formats
  console.log('\n--- 8. Color & Palette Conversion Engine ---');
  // 15-bit BGR555: Pure White (0x7FFF)
  const whiteRgba = bgr555ToRgba(0x7fff);
  assert(whiteRgba.r === 255 && whiteRgba.g === 255 && whiteRgba.b === 255, '0x7FFF converts to 255,255,255');
  const whiteBgr = rgbToBgr555(255, 255, 255);
  assert(whiteBgr === 0x7fff, 'RGB(255,255,255) converts to 0x7FFF');

  // Hex conversion
  const testHex = rgbaToHex({ r: 16, g: 185, b: 129, a: 255 });
  assert(testHex.toLowerCase() === '#10b981', `Hex encoding produces #10b981 (got ${testHex})`);
  const parsedRgb = hexToRgb('#10b981');
  assert(parsedRgb.r === 16 && parsedRgb.g === 185 && parsedRgb.b === 129, 'hexToRgb parses #10b981 accurately');

  // 9. GBA Text Encoding and Decoding
  console.log('\n--- 9. GBA Text Engine ---');
  const sampleText = 'POKéMON EMERALD!';
  const encoded = encodeGBAText(sampleText, 20);
  assert(encoded.length === 20, 'encodeGBAText returns padded 20-byte array');
  const decoded = decodeGBAText(encoded, 0, 20);
  assert(decoded.text.trim().startsWith('POKéMON EMERALD'), `Decoded text matches original string (got "${decoded.text}")`);

  // 10. Virtual Workspace & DeltaManager (Non-Destructive)
  console.log('\n--- 10. Virtual Workspace & Delta Engine ---');
  const dm = new DeltaManager(rom, validation.crc32Hex);
  assert(dm.getModifiedCount() === 0, 'Initial delta count is 0');

  // Modify Treecko stats
  dm.updateBaseStats(277, { hp: 99, attack: 110, speed: 140 });
  assert(dm.getModifiedCount() === 1, 'Delta count is 1 after updating Treecko stats');
  const effTreecko = dm.getEffectiveBaseStats(277);
  assert(effTreecko.hp === 99 && effTreecko.attack === 110 && effTreecko.speed === 140, 'Effective Treecko stats reflect deltas');

  // Modify Potion price
  dm.updateItem(13, { price: 50 });
  const effPotion = dm.getEffectiveItem(13);
  assert(effPotion.price === 50, 'Potion price delta reflects 50 Pokédollars');

  // Modify Map Layout & Collision Tags
  const initialMap = getMapLayout(rom, 0, 9, 15, 15);
  dm.updateMapMetatile('bank_0_map_9', 5, 0x08, initialMap);
  dm.updateMapCollision('bank_0_map_9', 5, 0x0c, initialMap);
  const effMap = dm.getEffectiveMap('bank_0_map_9', initialMap);
  assert(effMap.blocks[5] === 0x08, 'Effective map reflects modified metatile block 0x08');
  assert(effMap.collisions[5] === 0x0c, 'Effective map reflects modified collision tag 0x0c');

  // Undo and Redo operations
  assert(dm.canUndo(), 'DeltaManager canUndo() returns true');
  dm.undo();
  assert(dm.canRedo(), 'DeltaManager canRedo() returns true after undo');
  dm.redo();

  // Test map reset
  dm.resetMap('bank_0_map_9');
  const resetMapResult = dm.getEffectiveMap('bank_0_map_9', initialMap);
  assert(resetMapResult.blocks[5] === initialMap.blocks[5], 'resetMap reverts layout back to initial state');

  // Re-apply map modification for diff and build test
  dm.updateMapMetatile('bank_0_map_9', 5, 0x08, initialMap);

  // Generate binary diffs
  const diffs = dm.generateDiffs();
  assert(diffs.length > 0, `generateDiffs returned ${diffs.length} modified entries`);

  // Compile patched ROM
  const patchedROM = dm.compilePatchedROM();
  assert(patchedROM.length === rom.length, 'Compiled ROM matches original 16MB size');
  const patchedChecksumStatus = verifyGBAHeaderChecksum(patchedROM);
  assert(patchedChecksumStatus.isValid, 'Compiled ROM has valid Nintendo BIOS header checksum at 0xBD');

  // Verify byte injection in compiled ROM
  const treeckoOffset = OFFSETS.BASE_STATS_TABLE + 277 * OFFSETS.BASE_STATS_ENTRY_SIZE;
  assert(patchedROM[treeckoOffset] === 99, `Treecko HP byte at 0x${treeckoOffset.toString(16).toUpperCase()} is 99 in compiled ROM`);
  assert(patchedROM[treeckoOffset + 1] === 110, 'Treecko Attack byte is 110 in compiled ROM');
  assert(patchedROM[treeckoOffset + 3] === 140, 'Treecko Speed byte is 140 in compiled ROM');

  // Verify pristine base ROM was untouched
  assert(rom[treeckoOffset] === 40, 'Pristine base ROM remains untouched at 40 HP');

  // 11. .forge Archive Export & Import
  console.log('\n--- 11. .forge Archive Round-Trip ---');
  const forgeBlob = await dm.exportForgeArchive('Emerald_Comprehensive_Mod');
  assert(forgeBlob.size > 0, `.forge ZIP archive successfully generated (${forgeBlob.size} bytes)`);

  const dm2 = new DeltaManager(rom, validation.crc32Hex);
  assert(dm2.getModifiedCount() === 0, 'New DeltaManager starts clean');
  const importRes = await dm2.importForgeArchive(forgeBlob);
  assert(importRes.success, '.forge archive imported successfully');
  const importedTreecko = dm2.getEffectiveBaseStats(277);
  assert(importedTreecko.hp === 99 && importedTreecko.speed === 140, 'Imported workspace restored Treecko stat deltas');
  const importedPotion = dm2.getEffectiveItem(13);
  assert(importedPotion.price === 50, 'Imported workspace restored Potion price delta');
  const importedMap = dm2.getEffectiveMap('bank_0_map_9', initialMap);
  assert(importedMap.blocks[5] === 0x08, 'Imported workspace restored map override');

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
