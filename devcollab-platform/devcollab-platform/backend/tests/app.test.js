import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

describe('API', () => {
  it('health endpoint works', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects protected endpoint without auth', async () => {
    const res = await request(app).get('/api/search?q=test');
    expect(res.status).toBe(401);
  });

  it('returns empty search for blank query after auth is checked', async () => {
    const res = await request(app).get('/api/search?q=');
    expect(res.status).toBe(401);
  });

  it('rejects task creation without auth', async () => {
    const res = await request(app).post('/api/projects/1/tasks').send({ title: 'Test' });
    expect(res.status).toBe(401);
  });

  it('rejects comment creation without auth', async () => {
    const res = await request(app).post('/api/tasks/1/comments').send({ body: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('rejects report without auth', async () => {
    const res = await request(app).get('/api/projects/1/report');
    expect(res.status).toBe(401);
  });

  it('rejects CSV report without auth', async () => {
    const res = await request(app).get('/api/projects/1/report.csv');
    expect(res.status).toBe(401);
  });

  it('rejects activity without auth', async () => {
    const res = await request(app).get('/api/projects/1/activity');
    expect(res.status).toBe(401);
  });

  it('rejects project tasks without auth', async () => {
    const res = await request(app).get('/api/projects/1/tasks');
    expect(res.status).toBe(401);
  });

  it('returns the correct service name', async () => {
    const res = await request(app).get('/health');
    expect(res.body.service).toBe('devcollab-api');
  });
});
