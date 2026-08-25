import { Router, Request, Response } from 'express';
import { Config } from '../config';

const DEFAULT_AI_BASE = 'https://api.openai.com';

/**
 * Proxy for the frontend AI features (DesignGPT, AI simulation).
 *
 * The frontend posts the OpenAI request description to /ai/openai.json:
 *
 *   { openAIModel: '/v1/completions', openAIToken, openAIOrgID, openAIPayload }
 *
 * The backend forwards openAIPayload to `<base><openAIModel>` and streams the
 * upstream JSON back. The token is either the server side QUX_AI_TOKEN or, if
 * unset, the token supplied by the client.
 *
 * QUX_AI_ALLOWED_URLS (comma separated base URLs) restricts which upstream
 * hosts may be contacted; requests to other hosts are rejected.
 */
export function createAiRouter(config: Config): Router {
  const router = Router();

  const allowedBases = (config.aiAllowedUrls || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const resolveUpstream = (model: string): string | null => {
    if (model.startsWith('/')) {
      // relative path -> only ever the first allowed base (or the default)
      const base = allowedBases[0] || DEFAULT_AI_BASE;
      return base + model;
    }
    try {
      const url = new URL(model);
      const allowed = allowedBases.length > 0
        ? allowedBases.some((b) => model.startsWith(b + '/'))
        : url.origin === DEFAULT_AI_BASE;
      return allowed ? model : null;
    } catch {
      return null;
    }
  };

  router.post('/openai.json', async (req: Request, res: Response) => {
    const body = req.body || {};
    const model = String(body.openAIModel || '');
    const payload = body.openAIPayload;

    const upstreamUrl = resolveUpstream(model);
    if (!upstreamUrl || !payload) {
      return res.status(400).json({ error: 'ai.payload.invalid' });
    }

    const token = config.aiToken || String(body.openAIToken || '');
    if (!token) {
      return res.status(503).json({ error: 'ai.token.missing' });
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      if (body.openAIOrgID) {
        headers['OpenAI-Organization'] = String(body.openAIOrgID);
      }

      const upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await upstream.text();
      return res.status(upstream.status).type('json').send(data);
    } catch (err) {
      console.error('AI proxy error:', err);
      return res.status(502).json({ error: 'ai.upstream.error' });
    }
  });

  return router;
}
