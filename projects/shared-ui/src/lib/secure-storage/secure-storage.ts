/**
 * Dependency-free synchronous AES-256-CTR encryption for sensitive localStorage values.
 * Stored format: `enc:v1:<base64(iv || ciphertext)>`. Values without the marker are
 * treated as legacy plaintext and returned unchanged, so existing sessions keep working.
 */

const PREFIX = 'enc:v1:';

/** Session values that must not be stored in plain text. */
export const SENSITIVE_STORAGE_KEYS = [
  'token',
  'userMS-token',
  'user',
  'menuaccess',
  'roleAccess',
  'rememberedEmail',
] as const;

const SENSITIVE = new Set<string>(SENSITIVE_STORAGE_KEYS);

/* ---------------------------------- AES ---------------------------------- */

const SBOX = buildSbox();

function gfMul(a: number, b: number): number {
  let product = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) product ^= a;
    const high = a & 0x80;
    a = (a << 1) & 0xff;
    if (high) a ^= 0x1b;
    b >>= 1;
  }
  return product;
}

function rotl8(value: number, shift: number): number {
  return ((value << shift) | (value >>> (8 - shift))) & 0xff;
}

function buildSbox(): Uint8Array {
  const sbox = new Uint8Array(256);
  for (let x = 0; x < 256; x++) {
    let inverse = 0;
    if (x !== 0) {
      inverse = 1;
      let base = x;
      let exponent = 254; // a^(2^8-2) = a^-1 in GF(2^8)
      while (exponent > 0) {
        if (exponent & 1) inverse = gfMul(inverse, base);
        base = gfMul(base, base);
        exponent >>= 1;
      }
    }
    let value = inverse;
    for (let shift = 1; shift <= 4; shift++) value ^= rotl8(inverse, shift);
    sbox[x] = value ^ 0x63;
  }
  return sbox;
}

function xtime(value: number): number {
  return ((value << 1) ^ (value & 0x80 ? 0x1b : 0)) & 0xff;
}

/** AES-256 key schedule -> (Nr + 1) * 16 = 240 round-key bytes. */
function expandKey(key: Uint8Array): Uint8Array {
  const words = new Uint8Array(240);
  words.set(key.subarray(0, 32));
  let rcon = 1;
  for (let i = 8; i < 60; i++) {
    let t0 = words[(i - 1) * 4];
    let t1 = words[(i - 1) * 4 + 1];
    let t2 = words[(i - 1) * 4 + 2];
    let t3 = words[(i - 1) * 4 + 3];
    if (i % 8 === 0) {
      const first = t0;
      t0 = SBOX[t1] ^ rcon;
      t1 = SBOX[t2];
      t2 = SBOX[t3];
      t3 = SBOX[first];
      rcon = xtime(rcon);
    } else if (i % 8 === 4) {
      t0 = SBOX[t0];
      t1 = SBOX[t1];
      t2 = SBOX[t2];
      t3 = SBOX[t3];
    }
    words[i * 4] = words[(i - 8) * 4] ^ t0;
    words[i * 4 + 1] = words[(i - 8) * 4 + 1] ^ t1;
    words[i * 4 + 2] = words[(i - 8) * 4 + 2] ^ t2;
    words[i * 4 + 3] = words[(i - 8) * 4 + 3] ^ t3;
  }
  return words;
}

function encryptBlock(roundKeys: Uint8Array, block: Uint8Array): Uint8Array {
  const state = Uint8Array.from(block);
  const addRoundKey = (round: number): void => {
    const offset = round * 16;
    for (let i = 0; i < 16; i++) state[i] ^= roundKeys[offset + i];
  };

  addRoundKey(0);
  for (let round = 1; round <= 13; round++) {
    for (let i = 0; i < 16; i++) state[i] = SBOX[state[i]];
    // ShiftRows on a column-major state (index = row + 4 * column).
    for (let row = 0; row < 4; row++) {
      const values = [state[row], state[row + 4], state[row + 8], state[row + 12]];
      for (let column = 0; column < 4; column++) state[row + 4 * column] = values[(column + row) % 4];
    }
    // MixColumns.
    for (let column = 0; column < 4; column++) {
      const i = column * 4;
      const a0 = state[i];
      const a1 = state[i + 1];
      const a2 = state[i + 2];
      const a3 = state[i + 3];
      state[i] = xtime(a0) ^ xtime(a1) ^ a1 ^ a2 ^ a3;
      state[i + 1] = a0 ^ xtime(a1) ^ xtime(a2) ^ a2 ^ a3;
      state[i + 2] = a0 ^ a1 ^ xtime(a2) ^ xtime(a3) ^ a3;
      state[i + 3] = xtime(a0) ^ a0 ^ a1 ^ a2 ^ xtime(a3);
    }
    addRoundKey(round);
  }
  for (let i = 0; i < 16; i++) state[i] = SBOX[state[i]];
  for (let row = 0; row < 4; row++) {
    const values = [state[row], state[row + 4], state[row + 8], state[row + 12]];
    for (let column = 0; column < 4; column++) state[row + 4 * column] = values[(column + row) % 4];
  }
  addRoundKey(14);
  return state;
}

function aesCtr(key: Uint8Array, data: Uint8Array, iv: Uint8Array): Uint8Array {
  const roundKeys = expandKey(key);
  const counter = Uint8Array.from(iv);
  const out = new Uint8Array(data.length);
  for (let offset = 0; offset < data.length; offset += 16) {
    const keystream = encryptBlock(roundKeys, counter);
    for (let i = 15; i >= 8; i--) if (++counter[i] !== 0) break;
    const length = Math.min(16, data.length - offset);
    for (let i = 0; i < length; i++) out[offset + i] = data[offset + i] ^ keystream[i];
  }
  return out;
}

/** App-specific 256-bit key (hex). */
const KEY = Uint8Array.from(
  (
    '6f2d9c1b8e4a7d3f5c0b6e2a9d4f1c7b' + '3e8a5d2c9f6b0e4a7c1d8f3b5a2e6c9d'
  ).match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
);

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encrypts a plain value into the storable `enc:v1:` format. */
export function encryptValue(value: string): string {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const ciphertext = aesCtr(KEY, new TextEncoder().encode(value), iv);
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv);
  packed.set(ciphertext, iv.length);
  return PREFIX + toBase64(packed);
}

/** Decrypts a stored value; legacy plaintext (no marker) is returned as-is. */
export function decryptValue(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  try {
    const packed = fromBase64(value.slice(PREFIX.length));
    const plaintext = aesCtr(KEY, packed.subarray(16), packed.subarray(0, 16));
    return new TextDecoder().decode(plaintext);
  } catch {
    return '';
  }
}

/**
 * Drop-in replacement for `localStorage` for sensitive keys:
 * reads transparently decrypt, writes transparently encrypt, non-sensitive
 * keys are passed through untouched.
 */
export const secureStorage = {
  get(key: string): string | null {
    const raw = localStorage.getItem(key);
    if (raw === null || !SENSITIVE.has(key) || !raw.startsWith(PREFIX)) return raw;
    return decryptValue(raw);
  },
  set(key: string, value: string): void {
    localStorage.setItem(key, SENSITIVE.has(key) ? encryptValue(value) : value);
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
};

