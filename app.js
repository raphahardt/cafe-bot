/*! cafe-bot by Raphael Hardt */

const Discord = require("discord.js");
const client = new Discord.Client();

const config = require("./config.json");
const packageCfg = require("./package.json");
const emojis = require("./emojis.json");
const perolaCountThreshold = 5;
const perolaValidEmojis = [
    emojis.wilted_flower
];

const mainChannelName = ['mesa-shop', 'mesa-do-cafe'];
const perolaChannelName = 'mesa-da-vergonha';
const permittedJequitiChannels = ['mesa-do-nsfw', 'log-e-comandos'];
const adminsIds = [
    '208028185584074763', // rapha
    '213818871478616064', // polly
    '198097341977329664', // nemie
    '132137996995526656', // dani
    '164083196999237633', // lucas
    '256880100732174337' // rihawf
];

client.on("ready", onReady);
/**
 * Invocado toda vez que o bot é conectado
 */
function onReady() {
    console.log(`Bot cafe-bot v${packageCfg.version} [${client.users.size} membros] [${client.channels.size} canais] [${client.guilds.size} server]`);

    // modifica o "playing" do bot
    //client.user.setGame(`on ${client.guilds.size} servers`);
    client.user.setGame(`${packageCfg.version}`);
}

/**
 * Envia a mensagem de jequiti no canal que ele foi detectado
 *
 * @param {Message} message
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
};

/**
 * Retorna TRUE
 * @param {GuildMember} member
 * @returns {boolean}
 */
function verifyUserIsBot(member) {
    // mudei pra essa verificação, pq verificar pela role abre brecha pra alguém
    // se colocar como bot e ser ignorado pelo cafe-bot.
    return member.user.bot;
    // a verificação antiga ->
    //return member.roles.some(r => ["bot"].includes(r.name));
}

/**
 * @deprecated
 * Retorna TRUE se o user for o cafe-bot
 * TODO: deletar essa função?
 *
 * @param {User} user
 * @returns {boolean}
 */
function verifyIsCafeBot(user) {
    return user.username === 'cafe' && user.discriminator === '5416';
}

/**
 *
 * @param {TextChannel|DMChannel|GroupDMChannel} channel
 * @returns {boolean}
 */
function isInPermittedChannel(channel) {
    return (permittedJequitiChannels.includes(channel.name));
}

client.on("messageDelete", onMessageDelete);
/**
 * Invocado ao deletar uma mensagem
 *
 * @param {Message} message A mensagem deletada
 */
function onMessageDelete(message) {
    if (verifyUserIsBot(message.member)) return;

    if (isInPermittedChannel(message.channel)) {
        if (verifyIsCafeBot(message.author)) {
            return;
        }
        console.log('DELETE MENSAGEM', message.content, message.embeds.length);
        sendMessage(message);
    }
}

client.on("messageUpdate", onMessageUpdate);
/**
 * Invocado ao editar uma mensagem no servidor.
 * Também é invocado ao colocar um embed que não esteja no cache.
 *
 * @param {Message} message A mensagem antes da edição
 * @param {Message} newMessage A mensagem depois da edição
 */
function onMessageUpdate(message, newMessage) {
    if (verifyUserIsBot(message.member)) return;

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

/**
 * Envia a mensagem no canal de pérolas (mesa-da-vergonha)
 *
 * @param {Message} originalMessage
 * @param {TextChannel} perolasChannel
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
 * @param {Message} message
 * @param {TextChannel} perolaChannel
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

client.on("messageReactionAdd", onReactionAdd);
/**
 * Invocado toda vez que alguém dá um reaction em alguma mensagem.
 *
 * @param {MessageReaction} messageReaction O objeto reaction, que contem a mensagem e o emoji dado
 * @param {User} user O usuário que fez essa reaction (pode ser membro do server ou não)
 */
function onReactionAdd(messageReaction, user) {
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

client.on("message", onMessage);
/**
 * Invocado toda vez que alguém manda alguma mensagem.
 * Essa é a porta de entrada entre a comunicação de um membro com o bot.
 *
 * @param {Message} message A mensagem enviada
 */
function onMessage(message) {
    if (verifyUserIsBot(message.member)) return;

    // ignora qualquer mensagem que não começar com o prefixo
    if (message.content.indexOf(config.prefix) !== 0) return;

    // pega o comando
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if (command === 'off' && message.author.id.toString() === '208028185584074763') {
        // desliga o bot
        message.channel.send(`Desligando...`)
            .then(() => {
                client.destroy();
            });

        return;
    }

    // pra pegar todas as mensagens pinnadas e postar no canal de pérolas
    if (command === 'pins') {
        const mainChannel = message.guild.channels.find('name', args[0] || mainChannelName[0]);
        const perolasChannel = message.guild.channels.find('name', perolaChannelName);

        if (!mainChannel || !perolasChannel) return;

        mainChannel.fetchPinnedMessages()
            .then(pinnedMessages => {
                pinnedMessages.forEach(pinMsg => {
                    sendPerolaMessage(pinMsg, perolasChannel);
                })
            });

        return;
    }

    // pra automaticamente limpar os xps dos admins (FIXME: não funcionou, mas vou deixar o código ai pq tem coisa util
    // if (command === 'xpadmin') {
    //     adminsIds.forEach(function (adminId) {
    //         message.channel.send(`-scores remove ${adminId} 99999`);
    //     });
    //     // message.channel.send('-scores')
    //     //     .then(msgSent => {
    //     //         // recebeu a mensagem, espera a mensagem ter ido
    //     //     })
    //     //     .catch(console.error);
    //
    //     // const collector = new Discord.MessageCollector(message.channel, m => m.author.bot === true,
    //     //     { time: 10000 });
    //     // collector.on('collect', msg => {
    //     //     console.log('RECEBI', msg.content);
    //     // })
    // }

}

// conecta o bot
client.login(process.env.DISCORD_TOKEN || config.token);
