/*
Create new instance of the stable_horde class to communicate with the REST API.
*/
const StableHorde = require('@zeldafan0225/stable_horde');

class Horde {
  constructor() {
    this.stable_horde = new StableHorde({
      cache_interval: 1000 * 10,
      cache: {
        generations_check: 1000 * 30,
      },
      default_token: process.env.HORDE_TOKEN,
    });
  }

  promiseImage(prompt) {
    return this.stable_horde.postAsyncGenerate({
      prompt,
      options: {
        token: process.env.HORDE_TOKEN,
      },
    });
  }

  checkImage(id) {
    return this.stable_horde.getGenerationStatus(id);
  }
}

module.exports = Horde;
