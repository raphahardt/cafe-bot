
const utils = require('../utils');
const adminsIds = require('../adminIds');
const Discord = require("discord.js");

let NSFW_MESSAGES = {};
let NSFW_MESSAGES_SEEN = {};

class Nsfw {
    constructor () {}

    static get name() { return 'nsfw' }

    static nsfwCommand(message, args) {
        if (message.channel instanceof Discord.DMChannel) {
            let code = args[0];

            // deleta a mensagem definivamente
            if (code === 'clear') {
                code = args[1];

                if (!NSFW_MESSAGES[code]) {
                    message.reply(`:white_check_mark: Mensagem \`${code}\` já excluída ou expirada.`);
                    return;
                }
                if (NSFW_MESSAGES[code].author === message.author.id
                    || adminsIds.includes(message.author.id)) {
                    // primeiro exclui o alerta de que teve aquela msg
                    NSFW_MESSAGES[code].msgSent.delete()
                        .then(() => {
                            delete NSFW_MESSAGES[code];
                            message.reply(`:white_check_mark: Mensagem \`${code}\` excluída com sucesso.`);
                        })
                        .catch(console.error);
                } else {
                    message.reply(`:x: Você não pode deletar essa mensagem.`);
                }
                return;
            }

            // se já não existir a msg
            NSFW_MESSAGES_SEEN[code] = NSFW_MESSAGES_SEEN[code] || [];

            if (!NSFW_MESSAGES[code] || NSFW_MESSAGES_SEEN[code].includes(message.author.id)) {
                message.reply(`:x: Mensagem \`${code}\` não existe. Provavelmente já expirou ou você já viu.`);
                return;
            }

            if (NSFW_MESSAGES[code]) {
                if (NSFW_MESSAGES[code].author === message.author.id) {
                    // ignorar responder se foi a propria pessoa pedindo pra ver a msg que ela mesma mandou
                    //return;
                }

                message.reply(NSFW_MESSAGES[code].content, NSFW_MESSAGES[code].options)
                    .then(msg => {
                        // marca como já visto por esse usuario
                        NSFW_MESSAGES_SEEN[code].push(message.author.id);

                        message.client.setTimeout(() => {
                            // msg se auto destrou em 120 segundos (2 minutos)
                            msg.delete();
                        }, 120000);
                    })
                    .catch(console.error);
            }
        } else {
            if (args.join(' ').match(/^(clear )?[0-9]{13,15}$/g)) {
                // tentou dar o comando de ver fora da dm
                message.author.createDM().then(dm => {
                    dm.send(`É aqui que você tem que dar o comando :)`);
                }).catch(console.error);
                return;
            }
            message.delete()
                .then(msg => {
                    return createNsfwAlert(msg);
                })
                .catch(console.error);
        }
    }

    /**
     * Invocado toda vez que alguém dá um reaction em alguma mensagem.
     *
     * @param {Discord.MessageReaction} messageReaction O objeto reaction, que contem a mensagem e o emoji dado
     * @param {Discord.User} user O usuário que fez essa reaction (pode ser membro do server ou não)
     */
    static onReactionAdd(messageReaction, user) {
        let reactCount = messageReaction.count;
        messageReaction.fetchUsers()
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
            })
            .catch(console.error);
    }

    static commands() {
        return {
            'nsfw': Nsfw.nsfwCommand
        }
    }

    static events() {
        return {
            'messageReactionAdd': Nsfw.onReactionAdd
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