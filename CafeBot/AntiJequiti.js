
const utils = require('../utils');
const Discord = require("discord.js");

// nomes dos canais que o bot vai verificar os jequitis
const permittedJequitiChannels = ['mesa-do-nsfw', 'testes'];

/**
 * Verifica as mensagens quando elas são editadas ou deletadas, e caso seja, posta
 * uma mensagem no canal revelando qual era a mensagem editada/deletada.
 */
class AntiJequiti {
    constructor() {}

    static get name() { return 'antijequiti' }

    /**
     * Invocado ao deletar uma mensagem
     *
     * @param {Discord.Message} message A mensagem deletada
     */
    static onMessageDelete(message) {
        // :eyes:
        if (verifyIsCafeBot(message.author) && isUser(message.mentions)) {
            warnUser(message.mentions.members.first(), message.channel);
            return;
        }

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
 * Retorna TRUE se o user for o cafe-bot
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

function isUser(messageMentions) {
    if (!messageMentions.users.array().length) {
        return false;
    }
    return messageMentions.users.first().id === '256880100732174337'
        || messageMentions.users.first().id === '164083196999237633';
}

function warnUser(member, channel) {
    const w = notWarned(member);
    if (w === 50) {
        member.removeRoles(['242281124892508170', '316568273296687104']);
        channel.send(new Buffer('Li4udm9jw6ogcGVyY2ViZXUgcXVlIGFnb3JhIHZvY8OqIGZvaSBsb25nZSBkZW1haXMgbsOpPyBBR09SQSBBQ0FCT1UsIFPDiVJJTy4=', 'base64').toString('utf8'));
        return;
    }
    if (w > 20) {
        channel.send(new Buffer('QyBIIEUgRyBB', 'base64').toString('utf8'));
        return;
    }
    if (w === 20) {
        member.removeRoles(['242281124892508170', '316568273296687104']);
        channel.send(new Buffer('VMOhLCBhZ29yYSB2b2PDqiBqw6EgYWJ1c291IGRhIG1pbmhhIHBhY2nDqm5jaWEuIFJvbGVzIHJldGlyYWRvcy4uLiBlIG7Do28gdmFpIHZvbHRhciBtYWlzLg==', 'base64').toString('utf8'));

        setTimeout(function () {
            channel.send(new Buffer('QnJpbmtzIDopIE1BUyBQRUxBIE1PUiBERSBERVVTIFBBUkEgREUgRkFaRVIgSVNTTy4=', 'base64').toString('utf8'), { reply: member });
            member.addRoles(['242281124892508170', '316568273296687104']);
        }, 300000);
        return;
    }
    if (w > 2) {
        channel.send(new Buffer('QXBlbmFzIHBhcmUu', 'base64').toString('utf8'));
        return;
    }

    if (w < 2) {
        let m = w === 0
            ? 'SG1tbS4uLiBTZSB2b2PDqiBkZWxldGFyIGEgcHLDs3hpbWEgbWVuc2FnZW0sIHZvY8OqIHZhaSBwZXJkZXIgc2V1IGNhcmdvIGRlIGFkbWluLi4u'
            : 'VGVtIGNlcnRlemEgcXVlIHZhaSBjb250aW51YXIgZmF6ZW5kbyBpc3NvPyBOw6NvIG1lIGRlc2FmaWUuIMOaTFRJTU8gQVZJU08u';
        channel.send(new Buffer(m, 'base64').toString('utf8'), { reply: member });

    } else if (w === 2) {
        // :eyes:
        const client = channel.client;
        channel.send(new Buffer('RXUgYXZpc2VpLg==', 'base64').toString('utf8'), { reply: member });
        member.removeRoles(['242281124892508170', '316568273296687104']);

        setTimeout(function () {
            channel.send(new Buffer('QXNzdXN0b3UgbsOpPyBQb2lzIGVudMOjbyBwYXJlLg==', 'base64').toString('utf8'), { reply: member });
            member.addRoles(['242281124892508170', '316568273296687104']);
        }, 35000);
    }
}

let insideWarn = {};
function notWarned(member) {
    if (!insideWarn[member.id]) {
        insideWarn[member.id] = 0;
    }

    return insideWarn[member.id]++;
}

module.exports = AntiJequiti;