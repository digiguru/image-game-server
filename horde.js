/*
Create new instance of the stable_horde class to communicate with the rest API
You can configure which cache should contain the data for what time
You can also configure at what interval the cache is checking if there are any data that should be deleted

The class also takes a default token. This is helpful if you want to use this package only using your own token.
The token is not a required argument in any method.

A default API route is also in the contrictor for changing where the requests are directed to (e.g. when using a subdomain like https://test.stablehorde.net)
*/
const StableHorde = require( "@zeldafan0225/stable_horde" )
class Horde {
    constructor() {
        this.stable_horde = new StableHorde({
            cache_interval: 1000 * 10,
            cache: {
                generations_check: 1000 * 30
            },
            default_token: process.env.HORDE_TOKEN
        })
    }
    promiseImage (prompt) {
        return this.stable_horde.postAsyncGenerate({
            prompt: prompt
        });
            // start the generation of an image with the given payload
       
        const check = await
    }
    checkImage (id) {
        return this.stable_horde.getGenerationStatus(id)
    }

}


module.exports = Horde;