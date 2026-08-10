const OpenAI = require('openai');

class Dalle {
  constructor({ apiKey = process.env.DALLE_TOKEN, client } = {}) {
    this.apiKey = apiKey;
    this.openai = client;
  }

  getClient() {
    if (!this.openai) {
      if (!this.apiKey) {
        throw new Error('DALLE_TOKEN is required to use the Dall-e generator');
      }

      this.openai = new OpenAI({ apiKey: this.apiKey });
    }

    return this.openai;
  }

  async promiseImage(prompt) {
    return this.getClient().images.generate({
      model: 'dall-e-2',
      prompt,
      n: 1,
      size: '512x512',
    });
  }
}

module.exports = Dalle;
