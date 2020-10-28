
const utils = require('../utils');
const adminsIds = require('../adminIds');
const Discord = require("discord.js");

const PermissionError = require('./Errors/PermissionError');

let NSFW_MESSAGES = {};
let NSFW_MESSAGES_SEEN = {};

class Nsfw {
    constructor () {}

    get modName() { return 'nsfw' }

    nsfwCommand(message, args) {
        if (message.channel instanceof Discord.DMChannel) {
            let code = args[0];

            // deleta a mensagem definivamente
            if (code === 'clear') {
                code = args[1];

                if (!NSFW_MESSAGES[code]) {
                    return message.reply(`:white_check_mark: Mensagem \`${code}\` já excluída ou expirada.`);
                }
                if (NSFW_MESSAGES[code].author === message.author.id
                    || adminsIds.includes(message.author.id)) {
                    // primeiro exclui o alerta de que teve aquela msg
                    return NSFW_MESSAGES[code].msgSent.delete()
                        .then(() => {
                            delete NSFW_MESSAGES[code];
                            return message.reply(`:white_check_mark: Mensagem \`${code}\` excluída com sucesso.`);
                        })
                        ;
                }
                throw new PermissionError(`Você não tem permissão de deletar essa mensagem.`);
            }

            // se já não existir a msg
            NSFW_MESSAGES_SEEN[code] = NSFW_MESSAGES_SEEN[code] || [];

            if (!NSFW_MESSAGES[code] || NSFW_MESSAGES_SEEN[code].includes(message.author.id)) {
                return message.reply(`:x: Mensagem \`${code}\` não existe. Provavelmente já expirou ou você já viu.`);
            }

            if (NSFW_MESSAGES[code]) {
                if (NSFW_MESSAGES[code].author === message.author.id) {
                    // ignorar responder se foi a propria pessoa pedindo pra ver a msg que ela mesma mandou
                    return;
                }

                return message.reply(NSFW_MESSAGES[code].content, NSFW_MESSAGES[code].options)
                    .then(msg => {
                        // marca como já visto por esse usuario
                        NSFW_MESSAGES_SEEN[code].push(message.author.id);

                        return msg.delete(120000);
                    })
                    ;
            }
        } else {
            if (args.join(' ').match(/^(clear )?[0-9]{13,15}$/g)) {
                // tentou dar o comando de ver fora da dm
                return message.author.createDM().then(dm => {
                    return dm.send(`É aqui que você tem que dar o comando :)`);
                });
            }

            // deleta a msg e cria um nsfw dela
            return message.delete()
                .then(msg => {
                    return createNsfwAlert(msg);
                });
        }
    }

    /**
     * Invocado toda vez que alguém dá um reaction em alguma mensagem.
     *
     * @param {Discord.MessageReaction} messageReaction O objeto reaction, que contem a mensagem e o emoji dado
     * @param {Discord.User} user O usuário que fez essa reaction (pode ser membro do server ou não)
     */
    onReactionAdd(messageReaction, user) {
        let reactCount = messageReaction.count;
        return messageReaction.users.fetch()
            .then(users => {
                if (users && !users.some(u => adminsIds.includes(u.id))) {
                    // ignora quem não for admin
                    return;
                }

                if (reactCount > 0 && messageReaction.emoji.name === '🔞') {
                    // marcar essa mensagem como nsfw
                    return messageReaction.message.delete();
                }
            })
            .then(msg => {
                if (msg) {
                    return createNsfwAlert(msg, true);
                }
            });
    }

    commands() {
        return {
            'nsfw': this.nsfwCommand
        }
    }

    events() {
        return {
            'messageReactionAdd': this.onReactionAdd
        }
    }
}

function createNsfwAlert(message, forcedByAdmin) {
    return new Promise((resolve, reject) => {

        const code = Date.now();
        let object = {
            code: code,
            author: message.author.id,
            content: null,
            options: {}
        };

        object.content = message.content;

        if (message.embeds.length) {
            object.content += "\n";
            message.embeds.map(emb => {
                object.content += emb.url + "\n";
            });
        }

        if (message.attachments.size) {
            //object.content += "\n";
            object.options.files = [];
            message.attachments.map(att => {
                //object.content += att.url + "\n";
                object.options.files.push({ attachment: att.proxyURL });
            });
        }

        if (message.author.bot) {
            // se tá sinalizando uma mensagem de bot, então não precisa mandar DM pra ele
            message.channel.send(`:underage: ${message.author} mandou uma mensagem NSFW. Para ver, mande \`+nsfw ${code}\` em dm para o bot.`)
                .then((msgSent) => {
                    object.msgSent = msgSent;
                    NSFW_MESSAGES[code] = object;
                    resolve(object);
                })
                .catch(reject);
        } else {
            message.author.createDM().then(dm => {
                return Promise.all([
                    dm.send(object.content, object.options),
                    dm.send((forcedByAdmin ? `Essa mensagem foi sinalizada como NSFW por um dos admins do grupo.` : `Essa mensagem foi marcada por você como NSFW.`)+` Se você quiser excluir permanentemente por algum motivo (ex: se arrependeu de mandar), responda aqui com \`+nsfw clear ${code}\``),
                    message.channel.send(`:underage: ${message.author} mandou uma mensagem NSFW. Para ver, mande \`+nsfw ${code}\` em dm para o bot.`)
                ]).then(([msg1, msg2, msgSent]) => {
                    object.msgSent = msgSent;
                    NSFW_MESSAGES[code] = object;
                    resolve(object);
                });
            }).catch(reject);
        }

    });
}

module.exports = Nsfw;
