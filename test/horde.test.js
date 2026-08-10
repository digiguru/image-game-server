const { test } = require('node:test');
const assert = require('node:assert/strict');
const Horde = require('../horde');

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test('promiseImage submits an async generation with authentication headers', async () => {
  const calls = [];
  const client = new Horde({
    token: 'test-token',
    clientAgent: 'image-game-server:test',
    baseUrl: 'https://horde.example/api/v2/',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ id: 'generation-123', kudos: 1 });
    },
  });

  const result = await client.promiseImage('a fox astronaut');

  assert.deepEqual(result, { id: 'generation-123', kudos: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://horde.example/api/v2/generate/async');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { prompt: 'a fox astronaut' });
  assert.equal(calls[0].options.headers.apikey, 'test-token');
  assert.equal(calls[0].options.headers['Client-Agent'], 'image-game-server:test');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
});

test('checkImage requests the full generation status', async () => {
  const calls = [];
  const client = new Horde({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ done: true, generations: [{ img: 'https://example.test/image.webp' }] });
    },
  });

  const result = await client.checkImage('id with spaces');

  assert.equal(calls[0].url, 'https://aihorde.net/api/v2/generate/status/id%20with%20spaces');
  assert.equal(calls[0].options.headers.apikey, '0000000000');
  assert.equal(result.done, true);
  assert.equal(result.generations[0].img, 'https://example.test/image.webp');
});

test('AI Horde API failures include status and response details', async () => {
  const client = new Horde({
    fetchImpl: async () => jsonResponse({ message: 'Invalid API key', rc: 'InvalidAPIKey' }, { status: 401 }),
  });

  await assert.rejects(
    client.promiseImage('a prompt'),
    (error) => {
      assert.equal(error.message, 'AI Horde request failed: Invalid API key');
      assert.equal(error.status, 401);
      assert.deepEqual(error.details, { message: 'Invalid API key', rc: 'InvalidAPIKey' });
      return true;
    },
  );
});

test('invalid generation inputs are rejected before making a request', async () => {
  let requests = 0;
  const client = new Horde({
    fetchImpl: async () => {
      requests += 1;
      return jsonResponse({});
    },
  });

  await assert.rejects(client.promiseImage('   '), /Prompt must be a non-empty string/);
  await assert.rejects(client.checkImage(''), /Generation id must be a non-empty string/);
  assert.equal(requests, 0);
});
