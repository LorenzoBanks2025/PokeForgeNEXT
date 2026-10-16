/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import {
  OFFSETS,
} from './constants';
import { patchGBAHeaderChecksum } from './checksum';
import {
  parseBaseStats,
  serializeBaseStats,
  parseItem,
  serializeItem,
} from './romReader';
import {
  BaseStats,
  ItemData,
  MapLayout,
  DeltaPatch,
  ForgeManifest,
  BinaryDiff,
} from '../types/rom';
import { encodeGBAText } from './gbaText';

export class DeltaManager {
  private baseRom: Uint8Array;
  private targetCRC32Hex: string;
  private patch: DeltaPatch = {
    baseStats: {},
    items: {},
    maps: {},
    texts: {},
  };
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  constructor(baseRom: Uint8Array, crc32Hex: string) {
    this.baseRom = baseRom;
    this.targetCRC32Hex = crc32Hex;
  }

  public getPatch(): DeltaPatch {
    return this.patch;
  }

  public getCRC32(): string {
    return this.targetCRC32Hex;
  }

  private saveStateForUndo(): void {
    this.undoStack.push(JSON.stringify(this.patch));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): void {
    if (!this.canUndo()) return;
    this.redoStack.push(JSON.stringify(this.patch));
    const previous = this.undoStack.pop()!;
    this.patch = JSON.parse(previous);
  }

  public redo(): void {
    if (!this.canRedo()) return;
    this.undoStack.push(JSON.stringify(this.patch));
    const next = this.redoStack.pop()!;
    this.patch = JSON.parse(next);
  }

  // Pokémon Base Stats
  public getEffectiveBaseStats(speciesId: number): BaseStats {
    const base = parseBaseStats(this.baseRom, speciesId);
    const delta = this.patch.baseStats[speciesId];
    if (!delta) return base;
    return { ...base, ...delta };
  }

  public updateBaseStats(speciesId: number, changes: Partial<BaseStats>): void {
    this.saveStateForUndo();
    const current = this.patch.baseStats[speciesId] || {};
    this.patch.baseStats[speciesId] = { ...current, ...changes };
  }

  public resetSpecies(speciesId: number): void {
    this.saveStateForUndo();
    delete this.patch.baseStats[speciesId];
  }

  // Items
  public getEffectiveItem(itemId: number): ItemData {
    const base = parseItem(this.baseRom, itemId);
    const delta = this.patch.items[itemId];
    if (!delta) return base;
    return { ...base, ...delta };
  }

  public updateItem(itemId: number, changes: Partial<ItemData>): void {
    this.saveStateForUndo();
    const current = this.patch.items[itemId] || {};
    this.patch.items[itemId] = { ...current, ...changes };
  }

  public resetItem(itemId: number): void {
    this.saveStateForUndo();
    delete this.patch.items[itemId];
  }

  // Maps
  public getEffectiveMap(mapKey: string, defaultLayout: MapLayout): MapLayout {
    const delta = this.patch.maps[mapKey];
    if (!delta) return defaultLayout;
    return {
      ...defaultLayout,
      blocks: delta.blocks ? [...delta.blocks] : [...defaultLayout.blocks],
      collisions: delta.collisions ? [...delta.collisions] : [...defaultLayout.collisions],
    };
  }

  public updateMapMetatile(
    mapKey: string,
    index: number,
    metatileId: number,
    currentLayout: MapLayout
  ): void {
    this.saveStateForUndo();
    const currentBlocks = this.patch.maps[mapKey]?.blocks
      ? [...this.patch.maps[mapKey].blocks!]
      : [...currentLayout.blocks];
    currentBlocks[index] = metatileId;
    this.patch.maps[mapKey] = {
      ...this.patch.maps[mapKey],
      blocks: currentBlocks,
      collisions: this.patch.maps[mapKey]?.collisions || [...currentLayout.collisions],
    };
  }

  public updateMapCollision(
    mapKey: string,
    index: number,
    collisionFlag: number,
    currentLayout: MapLayout
  ): void {
    this.saveStateForUndo();
    const currentCollisions = this.patch.maps[mapKey]?.collisions
      ? [...this.patch.maps[mapKey].collisions!]
      : [...currentLayout.collisions];
    currentCollisions[index] = collisionFlag;
    this.patch.maps[mapKey] = {
      ...this.patch.maps[mapKey],
      blocks: this.patch.maps[mapKey]?.blocks || [...currentLayout.blocks],
      collisions: currentCollisions,
    };
  }

  public resetMap(mapKey: string): void {
    this.saveStateForUndo();
    delete this.patch.maps[mapKey];
  }

  // Texts
  public updateText(offset: number, text: string): void {
    this.saveStateForUndo();
    this.patch.texts[offset] = text;
  }

  public getModifiedCount(): number {
    return (
      Object.keys(this.patch.baseStats).length +
      Object.keys(this.patch.items).length +
      Object.keys(this.patch.maps).length +
      Object.keys(this.patch.texts).length
    );
  }

  /**
   * Generates a list of all binary byte differences between pristine ROM and patched state.
   */
  public generateDiffs(): BinaryDiff[] {
    const diffs: BinaryDiff[] = [];

    // Base stats diffs
    for (const [speciesIdStr, statsDelta] of Object.entries(this.patch.baseStats)) {
      const speciesId = Number(speciesIdStr);
      const effective = this.getEffectiveBaseStats(speciesId);
      const patchedBytes = serializeBaseStats(effective);
      const offset = OFFSETS.BASE_STATS_TABLE + speciesId * OFFSETS.BASE_STATS_ENTRY_SIZE;

      for (let i = 0; i < OFFSETS.BASE_STATS_ENTRY_SIZE; i++) {
        const orig = this.baseRom[offset + i];
        const modified = patchedBytes[i];
        if (orig !== modified) {
          diffs.push({
            offset: offset + i,
            originalByte: orig,
            newByte: modified,
            description: `${effective.name} Base Stats (byte +${i})`,
          });
        }
      }
    }

    // Item diffs
    for (const [itemIdStr, itemDelta] of Object.entries(this.patch.items)) {
      const itemId = Number(itemIdStr);
      const effective = this.getEffectiveItem(itemId);
      const patchedBytes = serializeItem(effective);
      const offset = OFFSETS.ITEM_DATA_TABLE + itemId * OFFSETS.ITEM_DATA_ENTRY_SIZE;

      for (let i = 0; i < OFFSETS.ITEM_DATA_ENTRY_SIZE; i++) {
        const orig = this.baseRom[offset + i];
        const modified = patchedBytes[i];
        if (orig !== modified) {
          diffs.push({
            offset: offset + i,
            originalByte: orig,
            newByte: modified,
            description: `${effective.name} Item Data (byte +${i})`,
          });
        }
      }
    }

    // Text diffs
    for (const [offsetStr, text] of Object.entries(this.patch.texts)) {
      const offset = Number(offsetStr);
      const encoded = encodeGBAText(text);
      for (let i = 0; i < encoded.length; i++) {
        const orig = this.baseRom[offset + i];
        const modified = encoded[i];
        if (orig !== modified) {
          diffs.push({
            offset: offset + i,
            originalByte: orig,
            newByte: modified,
            description: `Dialogue String at 0x${offset.toString(16).toUpperCase()} (char +${i})`,
          });
        }
      }
    }

    // Map overrides diffs
    for (const [mapKey, mapDelta] of Object.entries(this.patch.maps)) {
      if (mapDelta.blocks) {
        diffs.push({
          offset: 0,
          originalByte: 0,
          newByte: mapDelta.blocks.length,
          description: `Map [${mapKey}]: Modified layout blocks (${mapDelta.blocks.length} metatiles)`,
        });
      }
      if (mapDelta.collisions) {
        diffs.push({
          offset: 0,
          originalByte: 0,
          newByte: mapDelta.collisions.length,
          description: `Map [${mapKey}]: Modified collision & behavior tags`,
        });
      }
    }

    return diffs;
  }

  /**
   * Compiles the full patched ROM:
   * 1. Clones base ROM
   * 2. Injects modified base stats
   * 3. Injects modified items
   * 4. Injects modified strings
   * 5. Patches GBA Header Checksum at 0xBD
   */
  public compilePatchedROM(): Uint8Array {
    const rom = new Uint8Array(this.baseRom.length);
    rom.set(this.baseRom);

    // Apply base stats
    for (const [speciesIdStr] of Object.entries(this.patch.baseStats)) {
      const speciesId = Number(speciesIdStr);
      const stats = this.getEffectiveBaseStats(speciesId);
      const bytes = serializeBaseStats(stats);
      const offset = OFFSETS.BASE_STATS_TABLE + speciesId * OFFSETS.BASE_STATS_ENTRY_SIZE;
      rom.set(bytes, offset);
    }

    // Apply items
    for (const [itemIdStr] of Object.entries(this.patch.items)) {
      const itemId = Number(itemIdStr);
      const item = this.getEffectiveItem(itemId);
      const bytes = serializeItem(item);
      const offset = OFFSETS.ITEM_DATA_TABLE + itemId * OFFSETS.ITEM_DATA_ENTRY_SIZE;
      rom.set(bytes, offset);
    }

    // Apply text edits
    for (const [offsetStr, text] of Object.entries(this.patch.texts)) {
      const offset = Number(offsetStr);
      const bytes = encodeGBAText(text);
      rom.set(bytes, offset);
    }

    // Recalculate GBA BIOS header checksum at 0xBD
    patchGBAHeaderChecksum(rom);

    return rom;
  }

  /**
   * Exports a `.forge` project container archive (ZIP via JSZip).
   */
  public async exportForgeArchive(projectName: string = 'Pokemon_Emerald_Mod'): Promise<Blob> {
    const zip = new JSZip();

    const manifest: ForgeManifest = {
      format: 'pokeforge_workspace',
      version: '1.0.0',
      targetGame: 'POKEMON EMERALD',
      gameCode: 'BPEE',
      targetCRC32: this.targetCRC32Hex,
      author: 'PokeForge Modder',
      projectName,
      timestamp: Date.now(),
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Patches
    const patchesFolder = zip.folder('patches');
    if (patchesFolder) {
      patchesFolder.file('base_stats.json', JSON.stringify(this.patch.baseStats, null, 2));
      patchesFolder.file('items.json', JSON.stringify(this.patch.items, null, 2));
      patchesFolder.file('texts.json', JSON.stringify(this.patch.texts, null, 2));
    }

    // Maps
    const mapsFolder = zip.folder('maps');
    if (mapsFolder) {
      mapsFolder.file('map_overrides.json', JSON.stringify(this.patch.maps, null, 2));
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Imports a `.forge` project container archive.
   */
  public async importForgeArchive(file: Blob): Promise<{ success: boolean; error?: string }> {
    try {
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        return { success: false, error: 'Not a valid PokeForge project (missing manifest.json).' };
      }

      const manifestText = await manifestFile.async('text');
      const manifest: ForgeManifest = JSON.parse(manifestText);

      if (manifest.gameCode !== 'BPEE') {
        return { success: false, error: `Incompatible project target: ${manifest.gameCode}` };
      }

      this.saveStateForUndo();

      // Read patches
      const baseStatsFile = zip.file('patches/base_stats.json');
      if (baseStatsFile) {
        this.patch.baseStats = JSON.parse(await baseStatsFile.async('text'));
      }

      const itemsFile = zip.file('patches/items.json');
      if (itemsFile) {
        this.patch.items = JSON.parse(await itemsFile.async('text'));
      }

      const textsFile = zip.file('patches/texts.json');
      if (textsFile) {
        this.patch.texts = JSON.parse(await textsFile.async('text'));
      }

      const mapsFile = zip.file('maps/map_overrides.json');
      if (mapsFile) {
        this.patch.maps = JSON.parse(await mapsFile.async('text'));
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to parse .forge archive' };
    }
  }
}
