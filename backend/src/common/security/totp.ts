import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Base32 encoding / decoding utilities for RFC 6238 TOTP compatibility.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleanInput[i]);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a random Base32 TOTP secret.
 */
export function generateTotpSecret(bytes = 20): string {
  const randomBytes = crypto.randomBytes(bytes);
  return base32Encode(randomBytes);
}

/**
 * Computes the 6-digit TOTP code for a secret and timestamp.
 */
export function generateTotpCode(secret: string, timestampMs = Date.now(), stepSeconds = 30): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;

  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code against a secret with a +/- 1 step drift tolerance (90s window).
 */
export function verifyTotpCode(
  secret: string,
  token: string,
  timestampMs = Date.now(),
  stepSeconds = 30,
  window = 1
): boolean {
  if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
    return false;
  }

  for (let i = -window; i <= window; i++) {
    const stepTime = timestampMs + i * stepSeconds * 1000;
    const expected = generateTotpCode(secret, stepTime, stepSeconds);
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}

/**
 * Formats an otpauth:// URI for QR code generation in authenticator apps.
 */
export function getTotpUri(username: string, secret: string, issuer = 'VYRON'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
