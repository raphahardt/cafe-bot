
const utils = require('../utils');

module.exports = {
    /**
     * Registra os eventos e comandos de um listener.
     *
     * @param {Discord.Client} discordClient
     * @param {ModuleActivator} modules
     * @param {Array} listeners
     */
    registerDiscordEvents: (discordClient, modules, listeners) => {

        // registrando os modulos no moduleActivator
        for (let i = 0; i < listeners.length; i++) {
            const listener = listeners[i];
            modules.modulesInstalled[listener.name] = listener;
        }

        discordClient.on('message', message => {
            if (message.author.bot) return;

            // ignora qualquer mensagem que não começar com o prefixo
            // e ignora tambem caso o comando for passado com espaço entre o prefixo e o comando
            if (message.content.indexOf(utils.prefix) !== 0
                || message.content.charAt(utils.prefix.length) === ' ') return;

            // pega o comando
            let argsString = message.content.slice(utils.prefix.length).trim();
            const args = parseArgs(argsString);
            const command = args.shift().toLowerCase();

            // comando especial para desligar o bot
            // FIXME: não tá desligando porra nenhuma, a aws religa ele caso ele fique offline kkkkk
            if (command === 'off' && message.author.id.toString() === '208028185584074763') {
                // desliga o bot
                message.channel.send(`Desligando...`)
                    .then(() => {
                        discordClient.destroy();
                    }).catch(console.error);

                return;
            }

            // invocando os comandos
            for (let i = 0; i < listeners.length; i++) {
                const listener = listeners[i];
                const lstCommands = listener.commands ? listener.commands() : {};

                // hook pra ver se o modulo tá desativado ou não
                if (modules.isDisabled(listener.name)) {
                    //console.log(`tentou registrar o comando do modulo ${listener.name}, mas ele tá desativado`);
                    continue;
                }

                for (let lstCommand in lstCommands) {
                    if (!lstCommands.hasOwnProperty(lstCommand)) continue;

                    //console.log('comando registrado ' + lstCommand);

                    if (command === lstCommand.toLowerCase()) {
                        console.log('invocando ' + command, args);
                        // chama o comando do listener registrado
                        lstCommands[lstCommand].call(listener, message, args);
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

                console.log('evento registrado ' + event);

                // registra um evento no client do discord
                // antigo código: discordClient.on(event, events[event]);
                discordClient.on(event, (...args) => {
                    // hook pra ver se o modulo tá desativado ou não
                    if (modules.isDisabled(listener.name)) {
                        console.log(`tentou executar o modulo ${listener.name}, mas ele tá desativado`);
                        return;
                    }

                    // executa o evento de fato
                    events[event].apply(listener, args);
                });
            }
        }
    }
};

/**
 * Separa os argumentos em um array. Se tiver entre aspas, ele
 * considera sendo uma parte do string
 *
 * @param string
 */
function parseArgs(string) {
    // tira os espaços repetidos, primeiro de tudo
    string = string.replace(/ +/g, ' ');

    let args = [];
    let insideQuote = false, argIdx = 0;
    for (let i = 0; i < string.length; i++) {
        const char = string.charAt(i);

        switch (char) {
            case ' ':
                if (!insideQuote) {
                    argIdx++;
                }
                break;
            case '"':
                insideQuote = !insideQuote;
                continue;
        }

        if (!args[argIdx]) {
            args[argIdx] = '';
        }
        args[argIdx] += char;
    }

    return args.map(e => e.trim()).filter(e => e.length > 0);
}