import { describe, it, expect } from '@jest/globals';
import axios from 'axios';

describe('Replay Attack Prevention', () => {
  const baseURL = 'http://localhost:8080';
  const apiKey = 'test_api_key';

  it('should reject replayed request with old timestamp', async () => {
    const oldTimestamp = new Date(Date.now() - 400000).toISOString(); // 400 seconds ago

    try {
      await axios.post(
        `${baseURL}/webhook/v1`,
        {
          command: 'v1/tasks/create',
          data: { title: 'Test' },
          meta: {
            requestId: 'req_replay',
            timestamp: oldTimestamp,
            source: 'test',
          },
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      fail('Should have rejected old timestamp');
    } catch (error: any) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error.message).toContain('too old');
    }
  });

  it('should reject future timestamp', async () => {
    const futureTimestamp = new Date(Date.now() + 120000).toISOString(); // 2 min future

    try {
      await axios.post(
        `${baseURL}/webhook/v1`,
        {
          command: 'v1/tasks/create',
          data: { title: 'Test' },
          meta: {
            requestId: 'req_future',
            timestamp: futureTimestamp,
            source: 'test',
          },
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      fail('Should have rejected future timestamp');
    } catch (error: any) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error.message).toContain('future');
    }
  });

  it('should accept request with fresh timestamp', async () => {
    const freshTimestamp = new Date().toISOString();

    const response = await axios.post(
      `${baseURL}/webhook/v1`,
      {
        command: 'v1/query/list',
        data: {},
        meta: {
          requestId: `req_fresh_${Date.now()}`,
          timestamp: freshTimestamp,
          source: 'test',
        },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    expect(response.status).toBe(200);
  });
});
