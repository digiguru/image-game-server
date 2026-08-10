const DEFAULT_BASE_URL = 'https://aihorde.net/api/v2';
const DEFAULT_ANONYMOUS_TOKEN = '0000000000';
const DEFAULT_CLIENT_AGENT = 'image-game-server:1.0:github.com/digiguru/image-game-server';

class Horde {
  constructor({
    fetchImpl = globalThis.fetch,
    token = process.env.HORDE_TOKEN || DEFAULT_ANONYMOUS_TOKEN,
    baseUrl = process.env.HORDE_API_URL || DEFAULT_BASE_URL,
    clientAgent = process.env.HORDE_CLIENT_AGENT || DEFAULT_CLIENT_AGENT,
  } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('A fetch implementation is required');
    }

    this.fetch = fetchImpl;
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.clientAgent = clientAgent;
  }

  async request(path, options = {}) {
    const headers = {
      Accept: 'application/json',
      apikey: this.token,
      'Client-Agent': this.clientAgent,
      ...options.headers,
    };

    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await this.fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const detail = payload && typeof payload === 'object' ? payload.message || payload.rc : payload;
      const message = detail || `HTTP ${response.status}`;
      const error = new Error(`AI Horde request failed: ${message}`);
      error.status = response.status;
      error.details = payload;
      throw error;
    }

    return payload;
  }

  promiseImage(prompt) {
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return Promise.reject(new TypeError('Prompt must be a non-empty string'));
    }

    return this.request('/generate/async', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  checkImage(id) {
    if (typeof id !== 'string' || !id.trim()) {
      return Promise.reject(new TypeError('Generation id must be a non-empty string'));
    }

    return this.request(`/generate/status/${encodeURIComponent(id)}`);
  }
}

module.exports = Horde;
