/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Decompresses standard GBA BIOS LZ77 (LZ10) compressed stream.
 * Format:
 * Byte 0: 0x10 (Magic)
 * Bytes 1..3: Decompressed size (little-endian uint24)
 * Followed by flag byte + up to 8 blocks:
 *   Bit = 0: 1 literal byte
 *   Bit = 1: 2-byte block -> length = (byteA >> 4) + 3, disp = ((byteA & 0xF) << 8 | byteB) + 1
 */
export function decompressLZ77(
  buffer: Uint8Array,
  offset: number = 0
): { decompressed: Uint8Array; compressedSize: number } {
  if (offset + 4 > buffer.length) {
    throw new Error('LZ77 header out of bounds');
  }

  const magic = buffer[offset];
  if (magic !== 0x10) {
    throw new Error(`Invalid LZ77 magic byte: 0x${magic.toString(16).padStart(2, '0')} (expected 0x10)`);
  }

  const decompressedSize =
    buffer[offset + 1] |
    (buffer[offset + 2] << 8) |
    (buffer[offset + 3] << 16);

  const output = new Uint8Array(decompressedSize);
  let srcPos = offset + 4;
  let dstPos = 0;

  while (dstPos < decompressedSize && srcPos < buffer.length) {
    const flagByte = buffer[srcPos++];

    for (let bit = 7; bit >= 0 && dstPos < decompressedSize && srcPos < buffer.length; bit--) {
      const isCompressed = (flagByte & (1 << bit)) !== 0;

      if (!isCompressed) {
        // Literal byte
        output[dstPos++] = buffer[srcPos++];
      } else {
        // Compressed block: 2 bytes
        if (srcPos + 1 >= buffer.length) break;
        const byteA = buffer[srcPos++];
        const byteB = buffer[srcPos++];

        const length = (byteA >> 4) + 3;
        const disp = (((byteA & 0x0f) << 8) | byteB) + 1;

        if (disp > dstPos) {
          // Bad displacement
          continue;
        }

        for (let i = 0; i < length && dstPos < decompressedSize; i++) {
          output[dstPos] = output[dstPos - disp];
          dstPos++;
        }
      }
    }
  }

  // Pad to 4-byte boundary as per GBA ROM alignment
  let totalRead = srcPos - offset;
  if (totalRead % 4 !== 0) {
    totalRead += 4 - (totalRead % 4);
  }

  return { decompressed: output, compressedSize: totalRead };
}

/**
 * Compresses an uncompressed byte stream using standard GBA BIOS LZ77 (LZ10).
 */
export function compressLZ77(input: Uint8Array): Uint8Array {
  const decompressedSize = input.length;
  // Maximum possible output size with flags + headers
  const maxOutputSize = Math.max(16, 4 + Math.ceil(input.length * 9 / 8) + 16);
  const output = new Uint8Array(maxOutputSize);

  // Write header: 0x10 followed by 24-bit size
  output[0] = 0x10;
  output[1] = decompressedSize & 0xff;
  output[2] = (decompressedSize >> 8) & 0xff;
  output[3] = (decompressedSize >> 16) & 0xff;

  let srcPos = 0;
  let dstPos = 4;

  while (srcPos < decompressedSize) {
    const flagPos = dstPos++;
    let flagByte = 0;

    for (let bit = 7; bit >= 0 && srcPos < decompressedSize; bit--) {
      // Find longest match within sliding window (max 4096 bytes backward)
      const windowStart = Math.max(0, srcPos - 4096);
      let bestLength = 0;
      let bestDisp = 0;

      const maxCheckLength = Math.min(18, decompressedSize - srcPos);

      if (maxCheckLength >= 3) {
        for (let w = srcPos - 1; w >= windowStart; w--) {
          let matchLen = 0;
          while (
            matchLen < maxCheckLength &&
            input[w + matchLen] === input[srcPos + matchLen]
          ) {
            matchLen++;
          }

          if (matchLen > bestLength) {
            bestLength = matchLen;
            bestDisp = srcPos - w;
            if (bestLength === 18) break; // Maximum match length reached
          }
        }
      }

      if (bestLength >= 3) {
        // Encode match
        flagByte |= 1 << bit;
        const dispVal = bestDisp - 1;
        const lenVal = bestLength - 3;
        output[dstPos++] = ((lenVal & 0x0f) << 4) | ((dispVal >> 8) & 0x0f);
        output[dstPos++] = dispVal & 0xff;
        srcPos += bestLength;
      } else {
        // Literal byte
        output[dstPos++] = input[srcPos++];
      }
    }

    output[flagPos] = flagByte;
  }

  // Pad to 4-byte boundary
  while (dstPos % 4 !== 0) {
    output[dstPos++] = 0;
  }

  return output.subarray(0, dstPos);
}
