/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BaseStats {
  speciesId: number;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  spAtk: number;
  spDef: number;
  type1: number;
  type2: number;
  catchRate: number;
  baseExpYield: number;
  evYield: number; // 2-byte bitfield
  item1: number;
  item2: number;
  genderRatio: number;
  eggCycles: number;
  baseFriendship: number;
  growthRate: number;
  eggGroup1: number;
  eggGroup2: number;
  ability1: number;
  ability2: number;
  safariZoneRunRate: number;
  colorFlip: number;
}

export interface EvolutionEntry {
  method: number;
  param: number;
  targetSpecies: number;
}

export interface LearnsetMove {
  level: number;
  moveId: number;
}

export interface ItemData {
  id: number;
  name: string;
  price: number;
  pocket: number;
  type: number;
  description: string;
  descriptionPtr: number;
  useCodePtr: number;
  parameter: number;
  scriptPtr: number;
}

export interface MapHeader {
  bankId: number;
  mapId: number;
  name: string;
  layoutPtr: number;
  eventPtr: number;
  scriptPtr: number;
  connectionsPtr: number;
  musicId: number;
  mapHeaderId: number;
  regionSection: number;
  caveFlag: number;
  weather: number;
  mapType: number;
  showMapName: number;
  battleScene: number;
}

export interface MapLayout {
  width: number;
  height: number;
  blocks: number[]; // 16-bit metatile values (combines metatile index & collision)
  collisions: number[]; // 0 = passable, 1 = solid, 0x0C = grass, 0x10 = surf, 0x38 = ledge, 0x69 = door
  tileset1Ptr?: number;
  tileset2Ptr?: number;
}

export interface DeltaPatch {
  baseStats: { [speciesId: number]: Partial<BaseStats> };
  items: { [itemId: number]: Partial<ItemData> };
  maps: { [mapKey: string]: { blocks?: number[]; collisions?: number[]; header?: Partial<MapHeader> } };
  texts: { [offset: number]: string };
}

export interface ForgeManifest {
  format: 'pokeforge_workspace';
  version: '1.0.0';
  targetGame: 'POKEMON EMERALD';
  gameCode: 'BPEE';
  targetCRC32: string;
  author: string;
  projectName: string;
  timestamp: number;
}

export interface BinaryDiff {
  offset: number;
  originalByte: number;
  newByte: number;
  description: string;
}
