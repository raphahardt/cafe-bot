/*! cafe-bot by Raphael Hardt */

const Discord = require("discord.js");
const client = new Discord.Client();

// TODO: deletar esse config? teoricamente está sendo usado env pro token agora
const config = require("./config.json");
const packageCfg = require("./package.json");

/**
 * Invocado toda vez que o bot é conectado
 */
client.on("ready", () => {
    console.log(`Bot cafe-bot v${packageCfg.version} [${client.users.size} membros] [${client.channels.size} canais] [${client.guilds.size} server]`);

    // modifica o "playing" do bot
    //client.user.setGame(`on ${client.guilds.size} servers`);
    client.user.setGame(`${packageCfg.version}`);
});

const CafeBot = require('./CafeBot');

// registra os eventos de cada um dos 'módulos' do bot
CafeBot.registerDiscordEvents(client, [
    require('./CafeBot/AntiJequiti'),
    require('./CafeBot/Perolas')
]);

// conecta o bot
client.login(process.env.DISCORD_TOKEN || config.token);
