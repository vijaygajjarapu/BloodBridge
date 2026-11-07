import crypto from 'crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_OPTIONS: crypto.ScryptOptions = {
  N: 16384, // CPU/memory cost
  r: 8,     // block size
  p: 1,     // parallelization
  maxmem: 32 * 1024 * 1024,
};

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // If plain password in testing or fallback
    if (!hash.includes('$')) {
      return resolve(password === hash);
    }

    const parts = hash.split('$');
    if (parts.length < 3) return resolve(false);

    const salt = parts[1];
    const key = parts[2];
    const keyBuffer = Buffer.from(key, 'hex');

    crypto.scrypt(password, salt, keyBuffer.length, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
    });
  });
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSecureOtp(): string {
  // Generate cryptographically secure 6-digit OTP
  const buffer = crypto.randomBytes(4);
  const code = (buffer.readUInt32BE(0) % 900000) + 100000;
  return code.toString();
}

export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
