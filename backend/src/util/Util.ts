import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export function hashPassword(s: string): string {
  return bcrypt.hashSync(s, bcrypt.genSaltSync());
}

export function matchPassword(candidate: string, storedHash: string): boolean {
  try {
    return bcrypt.compareSync(candidate, storedHash);
  } catch (err) {
    console.error('matchPassword() > Something went wrong when using bcrypt', err);
    return false;
  }
}

export function getRandomString(): string {
  const sha = crypto.createHash('sha256').update(uuidv4()).digest('hex');
  return sha.replace(/[?&$/.]/g, (c) => {
    switch (c) {
      case '?': return 'x';
      case '&': return 'd';
      case '$': return 'a';
      case '/': return 'z';
      case '.': return 'y';
      default: return c;
    }
  });
}

export function getFileType(fileName: string): string {
  if (!fileName) return '';
  const parts = fileName.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return '';
}

export function isEmailAllowed(email: string, allowedDomains: string): boolean {
  if (allowedDomains === '*') return true;
  const domains = allowedDomains.split(',').map((d) => d.trim()).filter(Boolean);
  if (domains.length === 0) return true;
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const userDomain = parts[1];
  return domains.some((d) => userDomain === d || userDomain.endsWith('.' + d));
}
