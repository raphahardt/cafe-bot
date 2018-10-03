
const emojis = require("../emojis.json");
const utils = require("../utils");
const Discord = require("discord.js");
const Cafebase = require('./Cafebase');

const PermissionError = require('./Errors/PermissionError');

// array com os canais que tem q ser ignorados
const perolaIgnoredChannelsIds = [
    '341395801093963787', // mural
    '391287769189580812', // propria meda da vergonha
    '318948034362736640', // nsfw
];

// nome do channel que vai receber as mensagens pérola
const perolaChannelId = '391287769189580812';

// DEV ---------------------------------
// const perolaCountThreshold = 1;
// const perolaRankings = [
//     {color: 9006414, count: 2},
//     {color: 14408667, count: 3},
//     {color: 14867071, count: 4},
//     {color: 11069183, count: 5},
// ];
// DEV ---------------------------------

// quantos reactions precisa ter pra ser uma pérola
const perolaCountThreshold = 5;
const perolaRankings = [
    {color: 9006414, count: 9},
    {color: 14408667, count: 13},
    {color: 14867071, count: 20},
    {color: 11069183, count: 30},
];
// quais emojis são escolhidos pra valer como um reaction válido
const perolaValidEmojis = [emojis.WILTED_FLOWER];

/**
 * Quando uma mensagem receber mais do que 5 reactions de um certo emoji, essa
 * mensagem vai pra um "mural" de mensagens vergonhosas.
 * Esse módulo controla essa parte.
 *
 */
class Perolas {
    constructor() {
        this.db = new Cafebase('perolas');
    }

    get modName() { return 'perolas' }

    /**
     * Invocado toda vez que alguém dá um reaction em alguma mensagem.
     *
     * @param {Discord.Guild} guild
     * @param {Discord.MessageReaction} messageReaction O objeto reaction, que contem a mensagem e o emoji dado
     * @param {Discord.User} user O usuário que fez essa reaction (pode ser membro do server ou não)
     */
    onReactionAdd(guild, messageReaction, user) {
        //console.log('REACTION', perolaValidEmojis.includes(messageReaction.emoji.name), messageReaction.count);
        const message = messageReaction.message;

        // ignora mensagens de bot
        if (message.author.bot) return;

        // ignora canais "especiais"
        if (perolaIgnoredChannelsIds.includes(message.channel.id)) return;

        // procura o canal pra mandar as mensagens pinnadas
        const perolasChannel = guild.channels.get(perolaChannelId);
        if (!perolasChannel) return;

        // ignora os reactions na propria mesa perola, pra nao entrar em loop infinito
        if (perolasChannel === message.channel) return;

        let reactCount = messageReaction.count;
        return messageReaction.fetchUsers()
            .then(users => {
                if (users && users.has(message.author.id)) {
                    reactCount--;
                }

                if (perolaValidEmojis.includes(messageReaction.emoji.name) && reactCount >= perolaCountThreshold) {
                    return sendPerolaMessage(this, message, perolasChannel, reactCount, users);
                }
            });
    }

    /**
     * Comando +pins
     * Serve pra pegar todas as mensagens pinnadas e jogar no channel de pérolas.
     *
     * @param {Discord.Guild} guild
     * @param {Discord.Message} message
     * @param {Array} args Parametros do comando
     */
    pinsCommand(guild, message, args) {
        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_MESSAGES)) {
            throw new PermissionError();
        }
        const mainChannel = guild.channels.find(c => c.name === args[0]);
        const perolasChannel = guild.channels.get(perolaChannelId);
        if (!mainChannel || !perolasChannel) return;

        // pega todas as mensagens pinnadas
        return mainChannel.fetchPinnedMessages()
            .then(pinnedMessages => {
                let all = [];
                pinnedMessages.forEach(pinMsg => {
                    // manda cada uma no channel de perolas
                    all.push(sendPerolaMessage(this, pinMsg, perolasChannel));
                });

                return Promise.all(all);
            });
    }

    commands() {
        return {
            'pins': [this.pinsCommand, { guild: true }]
        }
    }

    events() {
        return {
            'messageReactionAdd': [this.onReactionAdd, { guild: true }]
        }
    }

}


/**
 * Envia a mensagem no canal de pérolas (mesa-da-vergonha)
 *
 * @param {Perolas} perolas
 * @param {Discord.Message} originalMessage
 * @param {Discord.TextChannel} perolasChannel
 * @param {number} reactCount
 * @param {Collection<User>} reactUsers
 */
function sendPerolaMessage(perolas, originalMessage, perolasChannel, reactCount, reactUsers) {
    return perolaMessageAlreadyExists(perolas, originalMessage, perolasChannel).then(msgPosted => {
        const originalUser = originalMessage.author;

        const emb = new Discord.RichEmbed()
            .setAuthor(originalUser.username, originalUser.avatarURL)
            .setColor(3447003)
            .setDescription(originalMessage.content)
            .setTimestamp(originalMessage.createdAt);

        if (originalMessage.attachments.array().length) {
            emb.setImage(originalMessage.attachments.first().url);
        }

        if (!msgPosted) {
            const userReactLast = reactUsers.last();
            return doSendPerolaMessage(perolas, perolasChannel, originalMessage, emb, userReactLast);
        } else {
            let changeRank = false;

            for (let pos = 0; pos < perolaRankings.length; pos++) {
                if (reactCount >= perolaRankings[pos].count) {
                    emb.setColor(perolaRankings[pos].color);
                    changeRank = true;
                }
            }

            if (changeRank) {
                // pra atualizar o embed
                return msgPosted.edit({embed: emb});
            }
        }
    });
}

/**
 * Verifica se a mensagem já existe no pérolas
 *
 * @param {Perolas} perolas
 * @param {Discord.Message} message
 * @param {Discord.TextChannel} perolaChannel
 */
function perolaMessageAlreadyExists(perolas, message, perolaChannel) {
    return new Promise((resolve, reject) => {
        perolas.db.getOne('msgs/' + message.id)
            .then(infoMsg => {
                if (infoMsg && infoMsg.perolaId) {
                    perolaChannel.fetchMessage(infoMsg.perolaId)
                        .then(postedMsg => {
                            resolve(postedMsg);
                        })
                        .catch(() => {
                            // mensagem não existe ou deu algum problema em dar fetch nessa msg
                            // se for esse o caso, cria outro wilted
                            resolve(false);
                        });
                    return;
                }

                // não achou a msg
                resolve(false);
            })
            .catch((err) => {
                // erro é considerado msg não encontrada
                resolve(false);
            })
        ;
        // ref.child(`msgs/${message.id}`).once('value', snapshot => {
        //     let infoMsg = snapshot.val();
        //
        //     if (infoMsg && infoMsg.perolaId) {
        //         perolaChannel.fetchMessage(infoMsg.perolaId)
        //             .then(postedMsg => {
        //                 resolve(postedMsg);
        //             })
        //             .catch(() => {
        //                 // mensagem não existe ou deu algum problema em dar fetch nessa msg
        //                 // se for esse o caso, cria outro wilted
        //                 resolve(false);
        //             });
        //         return;
        //     }
        //
        //     // não achou a msg
        //     resolve(false);
        // });
    });
}

function doSendPerolaMessage(perolas, perolasChannel, originalMessage, emb, userReactLast) {
    return perolasChannel.send({embed: emb})
        .then(postedMsg => {
            const info = {
                perolaId: postedMsg.id,
                userReactLast: userReactLast ? userReactLast.id : null,
                timestamp: (new Date()).getTime()
            };
            return perolas.db.save('msgs/' + originalMessage.id, info);
        });
}

module.exports = Perolas;