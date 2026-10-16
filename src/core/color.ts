/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RGBAColor {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
  a: number; // 0..255
}

/**
 * Converts a GBA 15-bit BGR555 integer (0x7FFF) to an RGBA object.
 */
export function bgr555ToRgba(val: number, isTransparent: boolean = false): RGBAColor {
  const r5 = val & 0x1f;
  const g5 = (val >> 5) & 0x1f;
  const b5 = (val >> 10) & 0x1f;

  return {
    r: (r5 << 3) | (r5 >> 2),
    g: (g5 << 3) | (g5 >> 2),
    b: (b5 << 3) | (b5 >> 2),
    a: isTransparent ? 0 : 255,
  };
}

/**
 * Converts an RGB color (0..255 each) to a GBA 15-bit BGR555 16-bit integer.
 */
export function rgbToBgr555(r: number, g: number, b: number): number {
  const r5 = Math.round((r * 31) / 255) & 0x1f;
  const g5 = Math.round((g * 31) / 255) & 0x1f;
  const b5 = Math.round((b * 31) / 255) & 0x1f;

  return r5 | (g5 << 5) | (b5 << 10);
}

/**
 * Converts RGBA to CSS hex string "#RRGGBB".
 */
export function rgbaToHex(color: RGBAColor): string {
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}

/**
 * Parses CSS hex string "#RRGGBB" into RGB.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0,
  };
}

/**
 * Decodes a 16-color GBA palette (32 bytes) from raw bytes into an array of 16 RGBA colors.
 */
export function decodeGBAPalette(
  bytes: Uint8Array,
  offset: number = 0,
  transparentIndex0: boolean = true
): RGBAColor[] {
  const colors: RGBAColor[] = [];
  for (let i = 0; i < 16; i++) {
    const lo = bytes[offset + i * 2] || 0;
    const hi = bytes[offset + i * 2 + 1] || 0;
    const bgr = lo | (hi << 8);
    colors.push(bgr555ToRgba(bgr, transparentIndex0 && i === 0));
  }
  return colors;
}

/**
 * Encodes an array of 16 RGBA colors back into 32 bytes of GBA 15-bit BGR555 data.
 */
export function encodeGBAPalette(colors: RGBAColor[]): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 16 && i < colors.length; i++) {
    const c = colors[i];
    const bgr = rgbToBgr555(c.r, c.g, c.b);
    bytes[i * 2] = bgr & 0xff;
    bytes[i * 2 + 1] = (bgr >> 8) & 0xff;
  }
  return bytes;
}

/**
 * Decodes an 8x8 pixel 4BPP GBA tile (32 bytes) into an array of 64 palette indices (0..15).
 */
export function decode4BPPTile(bytes: Uint8Array, offset: number = 0): number[] {
  const pixels = new Array(64);
  let pixelIndex = 0;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x += 2) {
      const byte = bytes[offset + (y * 4 + (x >> 1))] || 0;
      // Lower nibble is first pixel, upper nibble is second pixel
      pixels[pixelIndex++] = byte & 0x0f;
      pixels[pixelIndex++] = (byte >> 4) & 0x0f;
    }
  }

  return pixels;
}

/**
 * Encodes an array of 64 palette indices (0..15) into 32 bytes of 4BPP GBA tile data.
 */
export function encode4BPPTile(pixels: number[]): Uint8Array {
  const bytes = new Uint8Array(32);
  let pixelIndex = 0;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x += 2) {
      const p1 = pixels[pixelIndex++] & 0x0f;
      const p2 = pixels[pixelIndex++] & 0x0f;
      bytes[y * 4 + (x >> 1)] = p1 | (p2 << 4);
    }
  }

  return bytes;
}

/**
 * Simple Median-Cut or nearest neighbor Color Quantization to reduce image RGBA pixels to 16 colors.
 */
export function quantizeTo16Colors(
  pixelData: ImageData
): { palette: RGBAColor[]; indexedPixels: number[] } {
  const { data, width, height } = pixelData;
  const totalPixels = width * height;

  // Extract unique colors
  const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < totalPixels * 4; i += 4) {
    const a = data[i + 3];
    if (a < 64) continue; // transparent pixel
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r >> 3},${g >> 3},${b >> 3}`;
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { r, g, b, count: 1 });
    }
  }

  // Pick top 15 most frequent colors (Index 0 is transparent background)
  const sortedColors = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
  const palette: RGBAColor[] = [
    { r: 0, g: 0, b: 0, a: 0 }, // Color 0: Transparent
  ];

  for (let i = 0; i < 15 && i < sortedColors.length; i++) {
    palette.push({
      r: sortedColors[i].r,
      g: sortedColors[i].g,
      b: sortedColors[i].b,
      a: 255,
    });
  }

  // Fill remaining slots if fewer than 16 colors
  while (palette.length < 16) {
    palette.push({ r: 0, g: 0, b: 0, a: 255 });
  }

  // Map each pixel to nearest palette color index
  const indexedPixels: number[] = new Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const pIdx = i * 4;
    const a = data[pIdx + 3];
    if (a < 64) {
      indexedPixels[i] = 0;
      continue;
    }

    const r = data[pIdx];
    const g = data[pIdx + 1];
    const b = data[pIdx + 2];

    let bestDist = Infinity;
    let bestColorIdx = 1;

    for (let c = 1; c < palette.length; c++) {
      const pal = palette[c];
      const dr = r - pal.r;
      const dg = g - pal.g;
      const db = b - pal.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestColorIdx = c;
      }
    }

    indexedPixels[i] = bestColorIdx;
  }

  return { palette, indexedPixels };
}
