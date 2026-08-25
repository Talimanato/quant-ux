import { Response } from 'express';

export function returnJson(res: Response, data: any): void {
  res.json(data);
}

export function returnOk(res: Response, message: string): void {
  res.json({ message });
}

export function returnError(res: Response, code: string | number, status = 405): void {
  res.status(status).json({ error: code });
}
