/*! cafe-bot by Raphael Hardt */

const Discord = require("discord.js");
const client = new Discord.Client({
    // ver: https://discord.js.org/#/docs/main/stable/typedef/ClientOptions?scrollTo=disabledEvents
    disabledEvents: ['TYPING_START']
});
const utils = require('./utils');

const packageCfg = require("./package.json");

/**
 * Invocado toda vez que o bot é conectado
 * TODO: fazer um arquivo de configuracao pra cada ambiente, puxando todas as variaveis tipo "numero de votos" pra um lugar onde eu possa mudar pora fazer teste sem ter que ficar mudando em dev e esquecendo de alterar depois q boto em produção
 */
client.on("ready", () => {
    console.log(`Bot cafe-bot v${packageCfg.version} [${client.users.size} membros] [${client.channels.size} canais] [${client.guilds.size} server]`);

    // sai de todas as guilds q não seja o café com pão
    client.guilds.array().forEach((guild) => {
        if (guild.id !== '213797930937745409') {
            guild.leave();
        }
    });

    // easter egg
    //client.channels.find('name', 'mesa-shop').fetchMessage('394125088896581653').then(msg => msg.react('💒')).catch(console.error);

    // modifica o "playing" do bot
    //client.user.setGame(`${phrases[0]} (${packageCfg.version})`);
    const phrases = utils.shuffle(['você tomar café', 'os ghosts safados', 'seus abcs']);
    client.user.setActivity(`${phrases[0]} (${packageCfg.version})`, { type: 'WATCHING' });

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
    //require('./CafeBot/AntiJequiti'), // rip *2017 ✝️2017
    require('./CafeBot/Perolas'),
    require('./CafeBot/AmigoSecreto'),
    require('./CafeBot/MeFala'),
    //require('./CafeBot/Audio'), // ainda não tá pronto
    require('./CafeBot/RoleChanger'),
    //require('./CafeBot/Wololo'), // fim do wololo (19/02/18 ✝)
    require('./CafeBot/Sorteio'),
    //require('./CafeBot/Exp'), // ainda não tá pronto
    require('./CafeBot/BattleRoyale'),
    require('./CafeBot/Nsfw'),
    require('./CafeBot/RemindMe'),
    require('./CafeBot/Gacha'),
]);

// conecta o bot
client.login(process.env.DISCORD_TOKEN);
