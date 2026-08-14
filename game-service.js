class GameService {
  constructor({ game, providers, onUsersChanged = () => {}, logger = null }) {
    this.game = game;
    this.providers = providers;
    this.onUsersChanged = onUsersChanged;
    this.logger = logger;
  }

  async addPrompt({ prompt, userID }) {
    if (!this.game.setPrompt({ prompt, userID })) return false;

    this.onUsersChanged();
    const provider = this.providers.get(this.game.generator);
    const startedAt = Date.now();

    try {
      const imageData = await provider.generate(prompt);
      if (this.game.updateImageData(imageData, userID)) {
        this.onUsersChanged();
      }
      this.logger?.info('image_generation_completed', {
        roomID: this.game.id,
        userID,
        generator: this.game.generator,
        durationMs: Date.now() - startedAt,
        result: imageData?.image ? 'image' : imageData?.imageid ? 'pending' : 'empty',
      });
      return true;
    } catch (error) {
      this.logger?.error('image_generation_failed', {
        roomID: this.game.id,
        userID,
        generator: this.game.generator,
        durationMs: Date.now() - startedAt,
        error: error.message,
      });
      throw error;
    }
  }

  async refreshImages() {
    const provider = this.providers.get(this.game.generator);
    let updated = 0;
    const startedAt = Date.now();

    try {
      for (const user of this.game.users.values()) {
        const imageData = await provider.refresh(user);
        if (this.game.updateImageData(imageData, user.userID)) {
          updated += 1;
          this.onUsersChanged();
        }
      }

      this.logger?.info('image_refresh_completed', {
        roomID: this.game.id,
        generator: this.game.generator,
        durationMs: Date.now() - startedAt,
        updated,
      });
      return updated;
    } catch (error) {
      this.logger?.error('image_refresh_failed', {
        roomID: this.game.id,
        generator: this.game.generator,
        durationMs: Date.now() - startedAt,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = { GameService };
