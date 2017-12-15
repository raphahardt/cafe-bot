
const utils = require('../utils');

module.exports = {
    /**
     * Registra os eventos e comandos de um listener.
     *
     * @param {Discord.Client} discordClient
     * @param {Array} listeners
     */
    registerDiscordEvents: function (discordClient, listeners) {

        discordClient.on('message', message => {
            if (utils.verifyUserIsBot(message.member)) return;

            // ignora qualquer mensagem que não começar com o prefixo
            if (message.content.indexOf(utils.prefix) !== 0) return;

            // pega o comando
            const args = message.content.slice(utils.prefix.length).trim().split(/ +/g);
            const command = args.shift().toLowerCase();

            // comando especial para desligar o bot
            // FIXME: não tá desligando porra nenhuma, a aws religa ele caso ele fique offline kkkkk
            if (command === 'off' && message.author.id.toString() === '208028185584074763') {
                // desliga o bot
                message.channel.send(`Desligando...`)
                    .then(() => {
                        discordClient.destroy();
                    });

                return;
            }

            // invocando os comandos
            for (let i = 0; i < listeners.length; i++) {
                const listener = listeners[i];
                const lstCommands = listener.commands ? listener.commands() : {};

                for (let lstCommand in lstCommands) {
                    if (!lstCommands.hasOwnProperty(lstCommand)) continue;

                    if (command === lstCommand) {
                        // chama o comando do listener registrado
                        lstCommands[lstCommand].call(discordClient, message, args);
                    }
                }
            }
        });

        // invocando os eventos
        for (let i = 0; i < listeners.length; i++) {
            const listener = listeners[i];
            const events = listener.events ? listener.events() : {};

            for (let event in events) {
                if (!events.hasOwnProperty(event)) continue;

                // registra um evento no client do discord
                discordClient.on(event, events[event]);
            }
        }
    }
};