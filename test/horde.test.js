const test = require('node:test');
const assert = require('node:assert/strict');
const Horde = require('../horde');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('submits image generation requests through the AI Horde REST API', async () => {
  const calls = [];
  const horde = new Horde({
    apiUrl: 'https://horde.example/api/v2/',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ id: 'generation-123' }, 202);
    },
    token: 'test-token',
  });

  const result = await horde.promiseImage('a neon castle');

  assert.deepEqual(result, { id: 'generation-123' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://horde.example/api/v2/generate/async');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(calls[0].options.headers, {
    Accept: 'application/json',
    'Client-Agent': 'image-game-server:1.0.0:github.com/digiguru/image-game-server',
    apikey: 'test-token',
    'Content-Type': 'application/json',
  });
  assert.deepEqual(JSON.parse(calls[0].options.body), { prompt: 'a neon castle' });
});

test('retrieves completed generation status and escapes request IDs', async () => {
  let requestedUrl;
  const horde = new Horde({
    apiUrl: 'https://horde.example/api/v2',
    fetchImpl: async (url) => {
      requestedUrl = url;
      return jsonResponse({
        done: true,
        generations: [{ img: 'https://images.example/result.png' }],
      });
    },
  });

  const result = await horde.checkImage('generation/123');

  assert.equal(requestedUrl, 'https://horde.example/api/v2/generate/status/generation%2F123');
  assert.equal(result.done, true);
  assert.equal(result.generations[0].img, 'https://images.example/result.png');
});

test('rejects failed AI Horde requests with the API error details', async () => {
  const horde = new Horde({
    fetchImpl: async () => jsonResponse({ message: 'No workers are available' }, 503),
  });

  await assert.rejects(
    horde.promiseImage('a dragon'),
    (error) => error.status === 503 && error.message === 'No workers are available',
  );
});
