const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DalleImageProvider,
  ImageProviderRegistry,
  MockImageProvider,
  StableHordeImageProvider,
  extractDalleImage,
  MOCK_IMAGE_URL,
} = require('../image-providers');

test('DALL-E output is normalized to the game image contract', async () => {
  assert.deepEqual(
    extractDalleImage({ data: [{ url: 'https://images.example/result.png' }] }),
    { image: 'https://images.example/result.png' },
  );
  assert.equal(extractDalleImage({ data: [] }), undefined);

  const provider = new DalleImageProvider({
    client: { promiseImage: async () => ({ data: [{ url: 'https://images.example/generated.png' }] }) },
  });
  assert.deepEqual(await provider.generate('a robot'), { image: 'https://images.example/generated.png' });
});

test('DALL-E provider contains upstream failures', async () => {
  const warnings = [];
  const provider = new DalleImageProvider({
    client: { promiseImage: async () => { throw new Error('upstream failed'); } },
    logger: { warn: (...args) => warnings.push(args) },
  });

  assert.equal(await provider.generate('a robot'), undefined);
  assert.equal(warnings.length, 1);
});

test('Mock provider is deterministic apart from its injected wait', async () => {
  let waited = false;
  const provider = new MockImageProvider({ wait: async () => { waited = true; } });

  assert.deepEqual(await provider.generate('ignored'), { image: MOCK_IMAGE_URL });
  assert.equal(waited, true);
  assert.equal(await provider.refresh({ imageid: 'anything' }), undefined);
});

test('Stable Horde normalizes queued generation and completed refreshes', async () => {
  const provider = new StableHordeImageProvider({
    client: {
      promiseImage: async () => ({ id: 'job-123' }),
      checkImage: async () => ({ done: true, generations: [{ img: 'base64-image' }] }),
    },
  });

  assert.deepEqual(await provider.generate('castle'), { imageid: 'job-123' });
  assert.deepEqual(await provider.refresh({ imageid: 'job-123' }), { image: 'base64-image' });
  assert.equal(await provider.refresh({ image: 'done', imageid: 'job-123' }), undefined);
});

test('provider registry rejects missing provider configuration', () => {
  const registry = new ImageProviderRegistry(new Map());
  assert.throws(() => registry.get('Dall-e'), /not configured/);
});
