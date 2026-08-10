const test = require('node:test');
const assert = require('node:assert/strict');
const Dalle = require('../dalle');

test('uses the current OpenAI images API', async () => {
  let request;
  const dalle = new Dalle({
    client: {
      images: {
        generate: async (options) => {
          request = options;
          return { data: [{ url: 'https://images.example/result.png' }] };
        },
      },
    },
  });

  const result = await dalle.promiseImage('a colourful game scene');

  assert.deepEqual(result, { data: [{ url: 'https://images.example/result.png' }] });
  assert.deepEqual(request, {
    model: 'dall-e-2',
    prompt: 'a colourful game scene',
    n: 1,
    size: '512x512',
  });
});

test('does not require a DALL-E token until that generator is selected', async () => {
  const dalle = new Dalle({ apiKey: undefined });

  await assert.rejects(
    dalle.promiseImage('a colourful game scene'),
    /DALLE_TOKEN is required/,
  );
});
