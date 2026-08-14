const test = require('node:test');
const assert = require('node:assert/strict');
const { GameSession } = require('../game-session');
const { GameService } = require('../game-service');

function createProvider({ generated = { image: 'generated-image' }, refreshed } = {}) {
  return {
    generatedPrompts: [],
    refreshedUsers: [],
    async generate(prompt) {
      this.generatedPrompts.push(prompt);
      return generated;
    },
    async refresh(user) {
      this.refreshedUsers.push(user.userID);
      return refreshed;
    },
  };
}

function createService(provider) {
  const game = new GameSession('test');
  game.setGenerator('Mock');
  game.addUser({ name: 'Alice', userID: 'alice' });
  let notifications = 0;
  const service = new GameService({
    game,
    providers: { get: () => provider },
    onUsersChanged: () => { notifications += 1; },
  });
  return { game, service, get notifications() { return notifications; } };
}

test('adding a prompt updates domain state then stores the generated image', async () => {
  const provider = createProvider();
  const harness = createService(provider);

  assert.equal(await harness.service.addPrompt({ prompt: 'a red robot', userID: 'alice' }), true);

  const user = harness.game.snapshotUsers()[0];
  assert.equal(user.prompt, 'a red robot');
  assert.equal(user.image, 'generated-image');
  assert.deepEqual(provider.generatedPrompts, ['a red robot']);
  assert.equal(harness.notifications, 2);
});

test('submitting the same prompt twice does not regenerate an image', async () => {
  const provider = createProvider();
  const harness = createService(provider);

  await harness.service.addPrompt({ prompt: 'same prompt', userID: 'alice' });
  assert.equal(await harness.service.addPrompt({ prompt: 'same prompt', userID: 'alice' }), false);
  assert.equal(provider.generatedPrompts.length, 1);
});

test('refreshImages delegates provider polling and publishes completed images', async () => {
  const provider = createProvider({ generated: { imageid: 'job-1' }, refreshed: { image: 'finished-image' } });
  const harness = createService(provider);

  await harness.service.addPrompt({ prompt: 'castle', userID: 'alice' });
  assert.equal(harness.game.snapshotUsers()[0].imageid, 'job-1');

  assert.equal(await harness.service.refreshImages(), 1);
  assert.equal(harness.game.snapshotUsers()[0].image, 'finished-image');
  assert.deepEqual(provider.refreshedUsers, ['alice']);
});
