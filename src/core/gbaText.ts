/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Mapping of Pokémon Gen 3 GBA bytecode to UTF-8 characters
const GBA_TO_CHAR: { [byte: number]: string } = {
  0x00: ' ',
  0x01: 'À',
  0x02: 'Á',
  0x03: 'Â',
  0x04: 'Ç',
  0x05: 'È',
  0x06: 'É',
  0x07: 'Ê',
  0x08: 'Ë',
  0x09: 'Ì',
  0x0b: 'Î',
  0x0c: 'Ï',
  0x0d: 'Ò',
  0x0e: 'Ó',
  0x0f: 'Ô',
  0x10: 'Œ',
  0x11: 'Ù',
  0x12: 'Ú',
  0x13: 'Û',
  0x14: 'Ñ',
  0x15: 'ß',
  0x16: 'à',
  0x17: 'á',
  0x19: 'ç',
  0x1a: 'è',
  0x1b: 'é',
  0x1c: 'ê',
  0x1d: 'ë',
  0x1e: 'ì',
  0x20: 'î',
  0x21: 'ï',
  0x22: 'ò',
  0x23: 'ó',
  0x24: 'ô',
  0x25: 'œ',
  0x26: 'ù',
  0x27: 'ú',
  0x28: 'û',
  0x29: 'ñ',
  0x2a: 'º',
  0x2b: 'ª',
  0x2d: '&',
  0x2e: '+',
  0x34: '[LV]',
  0x35: '=',
  0x36: ';',
  0x51: '¿',
  0x52: '¡',
  0x53: '[PK]',
  0x54: '[MN]',
  0x55: '[PO]',
  0x56: '[KE]',
  0x57: '[BL]',
  0x58: '[OC]',
  0x59: '[K]',
  0x5a: 'Í',
  0x5b: '%',
  0x5c: '(',
  0x5d: ')',
  0x68: 'â',
  0x6f: 'í',
  0x79: '⬆',
  0x7a: '⬇',
  0x7b: '⬅',
  0x7c: '➡',
  0x84: 'ᵉ',
  0x85: '<',
  0x86: '>',
  0xa1: '0',
  0xa2: '1',
  0xa3: '2',
  0xa4: '3',
  0xa5: '4',
  0xa6: '5',
  0xa7: '6',
  0xa8: '7',
  0xa9: '8',
  0xaa: '9',
  0xab: '!',
  0xac: '?',
  0xad: '.',
  0xae: '-',
  0xaf: '・',
  0xb0: '…',
  0xb1: '“',
  0xb2: '”',
  0xb3: '‘',
  0xb4: '’',
  0xb5: '♂',
  0xb6: '♀',
  0xb7: '¥',
  0xb8: ',',
  0xb9: '×',
  0xba: '/',
  0xfa: '\\l', // scroll line
  0xfb: '\\p', // page / wait button
  0xfe: '\\n', // line break
};

// Fill letters
for (let i = 0; i < 26; i++) {
  // Uppercase A-Z: 0xBB - 0xD4
  GBA_TO_CHAR[0xbb + i] = String.fromCharCode(65 + i);
  // Lowercase a-z: 0xD5 - 0xEE
  GBA_TO_CHAR[0xd5 + i] = String.fromCharCode(97 + i);
}

// Inverted lookup map
const CHAR_TO_GBA: { [char: string]: number } = {};
for (const [byteStr, char] of Object.entries(GBA_TO_CHAR)) {
  const byte = Number(byteStr);
  if (!CHAR_TO_GBA[char]) {
    CHAR_TO_GBA[char] = byte;
  }
}

/**
 * Decodes a sequence of bytes from Pokémon Emerald ROM format into standard UTF-8 string.
 */
export function decodeGBAText(
  bytes: Uint8Array,
  start: number = 0,
  maxLength: number = 1000
): { text: string; bytesRead: number } {
  let result = '';
  let i = 0;

  while (i < maxLength && start + i < bytes.length) {
    const b = bytes[start + i];
    if (b === 0xff) {
      // 0xFF marks end of string in GBA Pokémon
      i++;
      break;
    }

    if (b === 0xfd) {
      // Special macro/variable code (e.g. 0xFD 0x01 = Player name)
      if (start + i + 1 < bytes.length) {
        const subCode = bytes[start + i + 1];
        i += 2;
        if (subCode === 0x01) result += '[PLAYER]';
        else if (subCode === 0x02) result += '[BUFFER1]';
        else if (subCode === 0x03) result += '[BUFFER2]';
        else if (subCode === 0x06) result += '[RIVAL]';
        else result += `[VAR:${subCode.toString(16)}]`;
        continue;
      }
    }

    if (b === 0xfc) {
      // Color or formatting code: 0xFC <code> <param>
      if (start + i + 2 < bytes.length) {
        const cmd = bytes[start + i + 1];
        const val = bytes[start + i + 2];
        i += 3;
        result += `[FMT:${cmd.toString(16)}:${val.toString(16)}]`;
        continue;
      }
    }

    if (GBA_TO_CHAR[b] !== undefined) {
      result += GBA_TO_CHAR[b];
    } else {
      result += `\\x${b.toString(16).padStart(2, '0')}`;
    }
    i++;
  }

  return { text: result, bytesRead: i };
}

/**
 * Encodes a UTF-8 string into Pokémon Emerald GBA bytecode.
 * Automatically handles \n, \l, \p, and pads with 0xFF if fixedSize is specified.
 */
export function encodeGBAText(text: string, fixedSize?: number): Uint8Array {
  const result: number[] = [];
  let i = 0;

  while (i < text.length) {
    // Check for escape codes
    if (text[i] === '\\' && i + 1 < text.length) {
      const next = text[i + 1];
      if (next === 'n') {
        result.push(0xfe);
        i += 2;
        continue;
      } else if (next === 'l') {
        result.push(0xfa);
        i += 2;
        continue;
      } else if (next === 'p') {
        result.push(0xfb);
        i += 2;
        continue;
      }
    }

    // Check for tag macros like [PLAYER]
    if (text[i] === '[') {
      const closeIdx = text.indexOf(']', i);
      if (closeIdx !== -1) {
        const tag = text.substring(i, closeIdx + 1);
        if (tag === '[PLAYER]') {
          result.push(0xfd, 0x01);
          i = closeIdx + 1;
          continue;
        } else if (tag === '[RIVAL]') {
          result.push(0xfd, 0x06);
          i = closeIdx + 1;
          continue;
        } else if (tag === '[PK]') {
          result.push(0x53);
          i = closeIdx + 1;
          continue;
        } else if (tag === '[MN]') {
          result.push(0x54);
          i = closeIdx + 1;
          continue;
        }
      }
    }

    const char = text[i];
    if (CHAR_TO_GBA[char] !== undefined) {
      result.push(CHAR_TO_GBA[char]);
    } else {
      // Default to space if unmapped
      result.push(0x00);
    }
    i++;
  }

  // Add 0xFF string terminator
  result.push(0xff);

  if (fixedSize !== undefined) {
    const finalBuffer = new Uint8Array(fixedSize);
    finalBuffer.fill(0xff); // Standard GBA padding
    const copyLength = Math.min(result.length, fixedSize);
    for (let j = 0; j < copyLength; j++) {
      finalBuffer[j] = result[j];
    }
    return finalBuffer;
  }

  return new Uint8Array(result);
}
