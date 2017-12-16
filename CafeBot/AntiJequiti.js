
const utils = require('../utils');
const Discord = require("discord.js");

// nomes dos canais que o bot vai verificar os jequitis
const permittedJequitiChannels = ['mesa-do-nsfw', 'log-e-comandos'];

/**
 * Verifica as mensagens quando elas são editadas ou deletadas, e caso seja, posta
 * uma mensagem no canal revelando qual era a mensagem editada/deletada.
 */
class AntiJequiti {
    constructor() {}

    /**
     * Invocado ao deletar uma mensagem
     *
     * @param {Discord.Message} message A mensagem deletada
     */
    static onMessageDelete(message) {
        if (utils.verifyUserIsBot(message.member)) return;

        if (isInPermittedChannel(message.channel)) {
            if (verifyIsCafeBot(message.author)) {
                return;
            }
            console.log('DELETE MENSAGEM', message.content, message.embeds.length);
            sendMessage(message);
        }
    }

    /**
     * Invocado ao editar uma mensagem no servidor.
     * Também é invocado ao colocar um embed que não esteja no cache.
     *
     * @param {Discord.Message} message A mensagem antes da edição
     * @param {Discord.Message} newMessage A mensagem depois da edição
     */
    static onMessageUpdate(message, newMessage) {
        if (utils.verifyUserIsBot(message.member)) return;

        if (isInPermittedChannel(message.channel)) {
            if (verifyIsCafeBot(message.author)) {
                return;
            }
            console.log('UPDATE MENSAGEM', message.content, message.embeds.length);
            if (message.content.toString() !== newMessage.content.toString()) {
                sendMessage(message);
            }
        }
    }

    static events() {
        return {
            'messageUpdate': AntiJequiti.onMessageUpdate,
            'messageDelete': AntiJequiti.onMessageDelete
        }
    }

}

/**
 * @deprecated
 * Retorna TRUE se o user for o cafe-bot
 * TODO: deletar essa função?
 *
 * @param {Discord.User} user
 * @returns {boolean}
 */
function verifyIsCafeBot(user) {
    return user.username === 'cafe' && user.discriminator === '5416';
}

/**
 * Se o channel é um dos permitidos pelo bot.
 *
 * @param {Discord.TextChannel|Discord.DMChannel|Discord.GroupDMChannel} channel O channel a ser verificado
 * @returns {boolean}
 */
function isInPermittedChannel(channel) {
    return (permittedJequitiChannels.includes(channel.name));
}

/**
 * Envia a mensagem de jequiti no canal que ele foi detectado
 *
 * @param {Discord.Message} message
 */
function sendMessage(message) {
    let text = `:rotating_light: UM JEQUITI FOI IDENTIFICADO :rotating_light: ${message.author}: ${message.content}`;

    //console.log('ATTACH', message.attachments.array());

    const files = message.attachments.array();
    let options = {};

    if (files.length > 0) {
        let newFiles = [];
        files.forEach(f => {
            newFiles.push(new Discord.Attachment(f.url, f.filename));
        });

        options.files = newFiles;
    }

    message.channel.send(text, options);
}

module.exports = AntiJequiti;