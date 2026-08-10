const DEFAULT_API_URL = 'https://stablehorde.net/api/v2';
const ANONYMOUS_API_KEY = '0000000000';

class Horde {
  constructor({
    apiUrl = process.env.HORDE_API_URL || DEFAULT_API_URL,
    fetchImpl = globalThis.fetch,
    token = process.env.HORDE_TOKEN,
  } = {}) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
    this.token = token || ANONYMOUS_API_KEY;
  }

  async request(path, options = {}) {
    if (typeof this.fetch !== 'function') {
      throw new Error('A fetch implementation is required to use AI Horde');
    }

    const response = await this.fetch(`${this.apiUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Client-Agent': 'image-game-server:1.0.0:github.com/digiguru/image-game-server',
        apikey: this.token,
        ...options.headers,
      },
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(body?.message || body?.error || `AI Horde request failed with ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return body;
  }

  promiseImage(prompt) {
    return this.request('/generate/async', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
  }

  checkImage(id) {
    return this.request(`/generate/status/${encodeURIComponent(id)}`);
  }
}

module.exports = Horde;
