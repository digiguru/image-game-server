class GameService {
  constructor({ game, providers, onUsersChanged = () => {} }) {
    this.game = game;
    this.providers = providers;
    this.onUsersChanged = onUsersChanged;
  }

  async addPrompt({ prompt, userID }) {
    if (!this.game.setPrompt({ prompt, userID })) return false;

    this.onUsersChanged();
    const provider = this.providers.get(this.game.generator);
    const imageData = await provider.generate(prompt);
    if (this.game.updateImageData(imageData, userID)) {
      this.onUsersChanged();
    }
    return true;
  }

  async refreshImages() {
    const provider = this.providers.get(this.game.generator);
    let updated = 0;

    for (const user of this.game.users.values()) {
      const imageData = await provider.refresh(user);
      if (this.game.updateImageData(imageData, user.userID)) {
        updated += 1;
        this.onUsersChanged();
      }
    }

    return updated;
  }
}

module.exports = { GameService };
