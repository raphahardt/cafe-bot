
const EMOJIS = require("../emojis.json");
const Discord = require("discord.js");

// array com os possíveis nomes do canal principal, que vai ser lido os pins
const mainChannelName = ['mesa-shop', 'mesa-do-cafe'];

// nome do channel que vai receber as mensagens pérola
const perolaChannelName = 'mesa-da-vergonha';

// quantos reactions precisa ter pra ser uma pérola
const perolaCountThreshold = 5;
// quais emojis são escolhidos pra valer como um reaction válido
const perolaValidEmojis = [EMOJIS.WILTED_FLOWER];

/**
 * Quando uma mensagem receber mais do que 5 reactions de um certo emoji, essa
 * mensagem vai pra um "mural" de mensagens vergonhosas.
 * Esse módulo controla essa parte.
 *
 */
class Perolas {

    constructor() {}

    /**
     * Invocado toda vez que alguém dá um reaction em alguma mensagem.
     *
     * @param {Discord.MessageReaction} messageReaction O objeto reaction, que contem a mensagem e o emoji dado
     * @param {Discord.User} user O usuário que fez essa reaction (pode ser membro do server ou não)
     */
    static onReactionAdd(messageReaction, user) {
        console.log('REACTION', messageReaction.emoji.toString(), messageReaction.count);

        // procura o canal pra mandar as mensagens pinnadas
        const perolasChannel = messageReaction.message.guild.channels.find('name', perolaChannelName);

        // se não achou, ignora
        if (!perolasChannel) return;

        // ignora os reactions na propria mesa perola, pra nao entrar em loop infinito
        if (perolasChannel === messageReaction.message.channel) return;

        // ignora mensagens de bot também
        if (messageReaction.message.author.bot) return;

        if (perolaValidEmojis.includes(messageReaction.emoji.name) && messageReaction.count >= perolaCountThreshold) {
            sendPerolaMessage(messageReaction.message, perolasChannel);
        }
    }

    /**
     * Comando +pins
     * Serve pra pegar todas as mensagens pinnadas e jogar no channel de pérolas.
     *
     * @param {Discord.Message} message
     * @param {Array} args Parametros do comando
     */
    static pinsCommand(message, args) {
        const mainChannel = message.guild.channels.find('name', args[0] || mainChannelName[0]);
        const perolasChannel = message.guild.channels.find('name', perolaChannelName);

        if (!mainChannel || !perolasChannel) return;

        // pega todas as mensagens pinnadas
        mainChannel.fetchPinnedMessages()
            .then(pinnedMessages => {
                pinnedMessages.forEach(pinMsg => {
                    // manda cada uma no channel de perolas
                    sendPerolaMessage(pinMsg, perolasChannel);
                })
            });
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
 */
function sendPerolaMessage(originalMessage, perolasChannel) {
    if (!perolaMessageAlreadyExists(originalMessage, perolasChannel)) {
        const originalUser = originalMessage.author;

        const emb = new Discord.RichEmbed()
            .setAuthor(originalUser.username, originalUser.avatarURL)
            .setColor(3447003)
            .setDescription(originalMessage.content)
            .setTimestamp(originalMessage.createdAt);

        if (originalMessage.attachments.array().length) {
            emb.setImage(originalMessage.attachments.first().url);
        }

        perolasChannel.send({embed: emb});
    }
}

/**
 * Verifica se a mensagem já existe no pérolas
 *
 * @param {Discord.Message} message
 * @param {Discord.TextChannel} perolaChannel
 */
function perolaMessageAlreadyExists(message, perolaChannel) {
    let found = false;
    perolaChannel.messages.array().forEach(msg => {
        msg.embeds.forEach(embed => {
            // se a mensagem tiver o mesmo texto
            if (embed.description === message.content.toString()) {
                found = true;
                return true;
            }

            if (embed.image && message.attachments.array().length) {
                // se a mensagem tiver a mesma imagem URL
                if (embed.image.url === message.attachments.first().url) {
                    found = true;
                    return true;
                }
            }
        })
    });

    return found;
}

module.exports = Perolas;