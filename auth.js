const config = require("./config.json");

module.exports = {
    token: process.env.DISCORD_TOKEN || config.token,
    owner: process.env.DISCORD_OWNER || config.owner,
    prefix: process.env.DISCORD_PREFIX || config.prefix || 'r+',
};