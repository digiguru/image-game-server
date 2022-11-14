const { Configuration, OpenAIApi } = require("openai");



class Dalle {
    constructor() {
        this.configuration = new Configuration({
            apiKey: process.env.DALLE_TOKEN,
        });
        this.openai = new OpenAIApi(this.configuration);
    }
    async promiseImage (prompt) {
        return await this.openai.createImage({
            prompt: prompt,
            n: 1,
            size: "512x512",
          });
    }
}


module.exports = Dalle;