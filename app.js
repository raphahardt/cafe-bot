/*! cafe-bot by Raphael Hardt */
const Discord = require("discord.js");
const client = new Discord.Client({
    // ver: https://discord.js.org/#/docs/main/stable/typedef/ClientOptions?scrollTo=disabledEvents
    disabledEvents: ['TYPING_START']
});

const packageCfg = require("./package.json");

const CafeBot = require('./CafeBot')(packageCfg);
const ModuleActivator = require('./CafeBot/ModuleActivator');
const activator = new ModuleActivator();

// registra os eventos de cada um dos 'módulos' do bot
CafeBot.registerDiscordEvents(client, activator, [
    activator, // o próprio activator também possui comandos, então ele é um modulo também
    require('./CafeBot/Counter'),
    require('./CafeBot/Ping'),
    //require('./CafeBot/AntiJequiti'), // rip *2017 ✝️2017
    require('./CafeBot/Perolas'),
    //require('./CafeBot/AmigoSecreto'), TODO: reformular
    require('./CafeBot/MeFala'),
    //require('./CafeBot/Audio'), // ainda não tá pronto
    require('./CafeBot/RoleChanger'),
    //require('./CafeBot/Wololo'), // fim do wololo (19/02/18 ✝)
    require('./CafeBot/Sorteio'),
    //require('./CafeBot/Exp'), // ainda não tá pronto
    //require('./CafeBot/BattleRoyale'), // fim do battle royale (30/09/18 ✝)
    require('./CafeBot/Nsfw'),
    require('./CafeBot/RemindMe'),
    require('./CafeBot/Gacha'),
]);

// conecta o bot
client.login(process.env.DISCORD_TOKEN);
