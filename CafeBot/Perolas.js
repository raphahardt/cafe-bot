
const emojis = require("../emojis.json");
const utils = require("../utils");
const Discord = require("discord.js");

// array com os canais que tem q ser ignorados
const perolaIgnoredChannelsIds = [
    '341395801093963787', // mural
    '391287769189580812', // propria meda da vergonha
    '318948034362736640', // nsfw
];

// nome do channel que vai receber as mensagens pérola
const perolaChannelId = '391287769189580812';

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
    constructor() {}

    static get name() { return 'perolas' }

    /**
     * Invocado toda vez que alguém dá um reaction em alguma mensagem.
     *
     * @param {Discord.MessageReaction} messageReaction O objeto reaction, que contem a mensagem e o emoji dado
     * @param {Discord.User} user O usuário que fez essa reaction (pode ser membro do server ou não)
     */
    static onReactionAdd(messageReaction, user) {
        //console.log('REACTION', perolaValidEmojis.includes(messageReaction.emoji.name), messageReaction.count);

        // ignora canais "especiais"
        if (perolaIgnoredChannelsIds.includes(messageReaction.message.channel.id)) return;

        // procura o canal pra mandar as mensagens pinnadas
        const perolasChannel = messageReaction.message.guild.channels.get(perolaChannelId);
        if (!perolasChannel) return;

        // ignora os reactions na propria mesa perola, pra nao entrar em loop infinito
        if (perolasChannel === messageReaction.message.channel) return;

        // ignora mensagens de bot também
        if (utils.verifyUserIsBot(messageReaction.message.member)) return;

        let reactCount = messageReaction.count;
        messageReaction.fetchUsers()
            .then(users => {
                if (users && users.has(messageReaction.message.author.id)) {
                    reactCount--;
                }

                if (perolaValidEmojis.includes(messageReaction.emoji.name) && reactCount >= perolaCountThreshold) {
                    sendPerolaMessage(messageReaction.message, perolasChannel, reactCount);
                }
            })
            .catch(console.error);
    }

    /**
     * Comando +pins
     * Serve pra pegar todas as mensagens pinnadas e jogar no channel de pérolas.
     *
     * @param {Discord.Message} message
     * @param {Array} args Parametros do comando
     */
    static pinsCommand(message, args) {
        const mainChannel = message.guild.channels.find('name', args[0]);
        const perolasChannel = message.guild.channels.get(perolaChannelId);
        if (!mainChannel || !perolasChannel) return;

        // pega todas as mensagens pinnadas
        mainChannel.fetchPinnedMessages()
            .then(pinnedMessages => {
                pinnedMessages.forEach(pinMsg => {
                    // manda cada uma no channel de perolas
                    sendPerolaMessage(pinMsg, perolasChannel);
                })
            }).catch(console.error);
    }

    static commands() {
        return {
            'pins': Perolas.pinsCommand
        }
    }

    static events() {
        return {
            'messageReactionAdd': Perolas.onReactionAdd
        }
    }

}


/**
 * Envia a mensagem no canal de pérolas (mesa-da-vergonha)
 *
 * @param {Discord.Message} originalMessage
 * @param {Discord.TextChannel} perolasChannel
 * @param {number} reactCount
 */
function sendPerolaMessage(originalMessage, perolasChannel, reactCount) {
    const msgPosted = perolaMessageAlreadyExists(originalMessage, perolasChannel);
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
        perolasChannel.send({embed: emb});
    } else {
        let changeRank = false;
        //let emb = msgPosted.embeds[0];

        for (let pos = 0; pos < perolaRankings.length; pos++) {
            if (reactCount >= perolaRankings[pos].count) {
                emb.setColor(perolaRankings[pos].color);
                changeRank = true;
            }
        }

        if (changeRank) {
            // pra atualizar o embed
            msgPosted.edit({embed: emb});
        }
    }
}

/**
 * Verifica se a mensagem já existe no pérolas
 *
 * @param {Discord.Message} message
 * @param {Discord.TextChannel} perolaChannel
 */
function perolaMessageAlreadyExists(message, perolaChannel) {
    const arr = perolaChannel.messages.array();
    for (let i = 0; i < arr.length; i++) {
        const msg = arr[i];
        for (let j = 0; j < msg.embeds.length; j++) {
            const embed = msg.embeds[j];

            // se a mensagem tiver o mesmo texto
            if (message.content && embed.description === message.content.toString()) {
                return msg;
            }

            if (embed.image && message.attachments.array().length) {
                // se a mensagem tiver a mesma imagem URL
                if (embed.image.url === message.attachments.first().url) {
                    return msg;
                }
            }
        }
    }

    return false;
}

module.exports = Perolas;