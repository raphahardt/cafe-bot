/*! cafe-bot para testes by Raphael Hardt */

const Discord = require("discord.js");
const client = new Discord.Client();

const packageCfg = require("./package.json");

function _hookConsoleStream(stream, fn) {
    const oldWrite = stream.write;
    // hooka o método write, q é o que faz printar na stream
    stream.write = fn;

    return function() {
        // volta como estava
        stream.write = oldWrite;
    };
}

// hooka o console.log pra mandar todas as mensagens pra um canal de log do server
// let _unhookConsoleLog = _hookConsoleStream(process.stdout, (string, encoding, fd) => {
//     const logChannel = client.channels.find('name', 'testes');
//     if (logChannel) {
//         logChannel.send(string);
//     }
// });

client.on("ready", () => {
    console.log(`Bot cafe-bot v${packageCfg.version} [${client.users.size} membros] [${client.channels.size} canais] [${client.guilds.size} server]`);

    client.user.setGame(`${packageCfg.version} [testes]`);
});

client.on("disconnect", () => {
    // _unhookConsoleLog();
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
    //require('./CafeBot/Perolas'),
    //require('./CafeBot/AmigoSecreto'),
    //require('./CafeBot/MeFala')
]);

// conecta o bot
client.login(require('./config.json').token);
//client.login(process.env.DISCORD_TOKEN);
