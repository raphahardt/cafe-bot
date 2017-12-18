/*! cafe-bot by Raphael Hardt */

const Discord = require("discord.js");
const client = new Discord.Client();

const packageCfg = require("./package.json");

/**
 * Invocado toda vez que o bot é conectado
 */
client.on("ready", () => {
    console.log(`Bot cafe-bot v${packageCfg.version} [${client.users.size} membros] [${client.channels.size} canais] [${client.guilds.size} server]`);

    // modifica o "playing" do bot
    //client.user.setGame(`on ${client.guilds.size} servers`);
    client.user.setGame(`${packageCfg.version}`);

    // procura o canal pra mandar as mensagens pinnadas
    const logChannel = client.channels.find('name', 'log-e-comandos');
    if (logChannel) {
        const emb = new Discord.RichEmbed()
            .setColor(3447003)
            .setTitle(`Café bot v${packageCfg.version}`)
            .setDescription(`Conectado no server`)
            .setTimestamp(new Date());

        logChannel.send({embed: emb});
    }
});

const CafeBot = require('./CafeBot');
const ModuleActivator = require('./CafeBot/ModuleActivator');
const activator = new ModuleActivator();

// registra os eventos de cada um dos 'módulos' do bot
CafeBot.registerDiscordEvents(client, activator, [
    activator, // o próprio activator também possui comandos, então ele é um modulo também
    require('./CafeBot/Counter'),
    require('./CafeBot/Ping'),
    require('./CafeBot/AntiJequiti'),
    require('./CafeBot/Perolas'),
    require('./CafeBot/AmigoSecreto'),
    require('./CafeBot/MeFala')
]);

// conecta o bot
client.login(process.env.DISCORD_TOKEN);
