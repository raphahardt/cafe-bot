/*! cafe-bot by Raphael Hardt */
const Discord = require("discord.js");
const intents = new Discord.Intents([
    Discord.Intents.NON_PRIVILEGED, // include all non-privileged intents, would be better to specify which ones you actually need
    'GUILD_MEMBERS', // lets you request guild members (i.e. fixes the issue)
    'GUILD_MESSAGES',
]);
const client = new Discord.Client({
    // ver: https://discord.js.org/#/docs/main/stable/typedef/ClientOptions?scrollTo=disabledEvents
    disabledEvents: ['TYPING_START'],
    ws: { intents }
});

const packageCfg = require("./package.json");

const CafeBot = require('./CafeBot')(packageCfg);
const ModuleActivator = require('./CafeBot/ModuleActivator');
const activator = new ModuleActivator();

const gachaModule = new (require('./CafeBot/Gacha'))();

// registra os eventos de cada um dos 'módulos' do bot
CafeBot.registerDiscordEvents(client, activator, [
    activator, // o próprio activator também possui comandos, então ele é um modulo também
    new (require('./CafeBot/Counter'))(),
    new (require('./CafeBot/Ping'))(),
    //new (require('./CafeBot/AntiJequiti'))(), // rip *2017 ✝️2017
    new (require('./CafeBot/Perolas'))(),
    //new (require('./CafeBot/AmigoSecreto'))(), TODO: reformular
    new (require('./CafeBot/MeFala'))(),
    //new (require('./CafeBot/Audio'))(), // ainda não tá pronto
    new (require('./CafeBot/RoleChanger'))(),
    //new (require('./CafeBot/Wololo'))(), // fim do wololo (19/02/18 ✝)
    new (require('./CafeBot/Sorteio'))(),
    //new (require('./CafeBot/Exp'))(), // ainda não tá pronto
    //new (require('./CafeBot/BattleRoyale'))(), // fim do battle royale (30/09/18 ✝)
    new (require('./CafeBot/Nsfw'))(),
    new (require('./CafeBot/RemindMe'))(),
    gachaModule,
    new (require('./CafeBot/Quiz'))(gachaModule),
]);

// conecta o bot
client.login(process.env.DISCORD_TOKEN);
