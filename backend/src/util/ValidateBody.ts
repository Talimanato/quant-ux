import { Request, Response } from 'express';

/**
 * Returns true when the request body is missing or "empty":
 * - undefined / null / non-object values (e.g. when no JSON body was sent)
 * - empty arrays (e.g. `[]` for the bulk event/mouse endpoints)
 * - plain objects without any enumerable keys (e.g. `{}` sent by mistake)
 */
export function isBodyEmpty(body: any): boolean {
  if (!body || typeof body !== 'object') return true;
  if (Array.isArray(body)) return body.length === 0;
  return Object.keys(body).length === 0;
}

/**
 * Validates that the request body is an object (or a non-empty array) with at
 * least one entry. Sends a 400 response and returns false when the body is
 * empty, true when the request may proceed.
 *
 * Usage:
 *   if (!requireNonEmptyBody(req, res, 'app.body.empty')) return;
 */
export function requireNonEmptyBody(req: Request, res: Response, errorCode = 'request.body.empty'): boolean {
  if (isBodyEmpty(req.body)) {
    res.status(400).json({ error: errorCode });
    return false;
  }
  return true;
}

/**
 * Validates that the request body is non-empty and contains every key in
 * `keys` (a key counts as present when it is neither undefined, null nor an
 * empty string). Sends a 400 response and returns false when the check fails.
 *
 * Usage:
 *   if (!requireKeys(req, res, ['name'], 'lib.create.missing.name')) return;
 */
export function requireKeys(req: Request, res: Response, keys: string[], errorCode = 'request.body.missing.keys'): boolean {
  if (!requireNonEmptyBody(req, res, errorCode)) return false;

  const body = req.body as Record<string, any>;
  const missing = keys.filter((k) => body[k] === undefined || body[k] === null || body[k] === '');
  if (missing.length > 0) {
    res.status(400).json({ error: errorCode });
    return false;
  }
  return true;
}
