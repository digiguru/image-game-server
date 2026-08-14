const Dalle = require('./dalle');
const Horde = require('./horde');

const MOCK_IMAGE_URL = 'https://placehold.co/512x512?text=Mock+Image';

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function defaultMockWait() {
  return new Promise((resolve) => setTimeout(resolve, randomIntFromInterval(250, 1000)));
}

function extractDalleImage(output) {
  const image = output?.data?.[0]?.url;
  return image ? { image } : undefined;
}

class MockImageProvider {
  constructor({ wait = defaultMockWait } = {}) {
    this.wait = wait;
  }

  async generate() {
    await this.wait();
    return { image: MOCK_IMAGE_URL };
  }

  async refresh() {
    return undefined;
  }
}

class StableHordeImageProvider {
  constructor({ client = new Horde(), logger = console } = {}) {
    this.client = client;
    this.logger = logger;
  }

  async generate(prompt) {
    try {
      const output = await this.client.promiseImage(prompt);
      return output?.id ? { imageid: output.id } : undefined;
    } catch (error) {
      this.logger.warn?.('Stable Horde generation failed', error.message);
      return undefined;
    }
  }

  async refresh(user) {
    if (!user || user.image || !user.imageid) return undefined;

    try {
      const output = await this.client.checkImage(user.imageid);
      return output?.done === true && output.generations?.[0]?.img
        ? { image: output.generations[0].img }
        : undefined;
    } catch (error) {
      this.logger.warn?.('Stable Horde image check failed', error.message);
      return undefined;
    }
  }
}

class DalleImageProvider {
  constructor({ client = new Dalle(), logger = console } = {}) {
    this.client = client;
    this.logger = logger;
  }

  async generate(prompt) {
    try {
      return extractDalleImage(await this.client.promiseImage(prompt));
    } catch (error) {
      this.logger.warn?.('DALL-E generation failed', error.message);
      return undefined;
    }
  }

  async refresh() {
    return undefined;
  }
}

class ImageProviderRegistry {
  constructor(providers) {
    this.providers = providers || new Map([
      ['Mock', new MockImageProvider()],
      ['Stable Horde', new StableHordeImageProvider()],
      ['Dall-e', new DalleImageProvider()],
    ]);
  }

  get(name) {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Image provider is not configured: ${name}`);
    return provider;
  }
}

module.exports = {
  DalleImageProvider,
  ImageProviderRegistry,
  MockImageProvider,
  StableHordeImageProvider,
  extractDalleImage,
  MOCK_IMAGE_URL,
};
