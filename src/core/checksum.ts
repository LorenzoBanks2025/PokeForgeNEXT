/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// CRC32 Lookup Table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

/**
 * Calculates standard IEEE 802.3 CRC32 of a Uint8Array or ArrayBuffer.
 */
export function calculateCRC32(data: Uint8Array | ArrayBuffer): number {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Returns formatted 8-character uppercase hex CRC32 string (e.g. "1F3798D5")
 */
export function formatCRC32Hex(crc: number): string {
  return crc.toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Calculates the Nintendo GBA Header Checksum at byte offset 0xBD:
 * Checksum = -sum(ROM[0xA0..0xBC]) - 0x19 (mod 0x100)
 */
export function calculateGBAHeaderChecksum(rom: Uint8Array): number {
  let sum = 0;
  for (let i = 0xa0; i <= 0xbc; i++) {
    sum += rom[i];
  }
  // -sum - 0x19 mod 256
  const checksum = (0 - sum - 0x19) & 0xff;
  return checksum;
}

/**
 * Validates whether the GBA header checksum at 0xBD matches the computed checksum.
 */
export function verifyGBAHeaderChecksum(rom: Uint8Array): {
  isValid: boolean;
  expected: number;
  actual: number;
} {
  const expected = calculateGBAHeaderChecksum(rom);
  const actual = rom[0xbd];
  return {
    isValid: expected === actual,
    expected,
    actual,
  };
}

/**
 * Fixes the header checksum in place on the given Uint8Array.
 */
export function patchGBAHeaderChecksum(rom: Uint8Array): void {
  const checksum = calculateGBAHeaderChecksum(rom);
  rom[0xbd] = checksum;
}
