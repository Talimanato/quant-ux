import request from 'supertest';
import { createTestApp } from './setup';

/**
 * The AI proxy tests only cover validation. Real upstream calls need
 * QUX_AI_TOKEN and are not part of the unit test run.
 */
describe('AI proxy', () => {
  it('should reject invalid payloads', async () => {
    const { app } = createTestApp();

    const noModel = await request(app).post('/ai/openai.json').send({});
    expect(noModel.status).toBe(400);

    const notAllowed = await request(app)
      .post('/ai/openai.json')
      .send({
        openAIModel: 'https://evil.example.com/v1/completions',
        openAIPayload: { model: 'gpt-3.5-turbo' },
        openAIToken: 'sk-test'
      });
    expect(notAllowed.status).toBe(400);
  });

  it('should report a missing token as 503', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/ai/openai.json')
      .send({
        openAIModel: '/v1/completions',
        openAIPayload: { model: 'gpt-3.5-turbo', prompt: 'hi' }
      });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('ai.token.missing');
  });

  it('should acknowledge client error log reports', async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post('/rest/log/error')
      .send({ message: 'test error' });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('ok');
  });
});
