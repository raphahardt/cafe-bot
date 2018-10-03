
const utils = require('../utils');
const Discord = require("discord.js");

// média de palavras por minuto que o ser humano em média digita
// serve pra usar de base pra pessoas que digitam muito além rapido
// significam que podem estar spammando, e pessoas que estão muito lentas tbm
// podem estar abusando do timing de bonus de xp
// ser humano digita em média 65~80 palavras por minuto, segundo minhas pesquisas
// (porém sem base cientifica nenhuma, usei estatistica de amigos KKKK)
const AVERAGE_WORD_PER_MINUTE_MIN = 25;
const AVERAGE_WORD_PER_MINUTE_MAX = 112;

// TODO: como fazer em caso de penalidade pra algum usuário?
const expConfig = {
    gain: { // quantidades de ganho de xp
        min: 15,
        max: 34,
        cooldown: 5, // 5 segundos entre mensagens
    },
    multiplier: 1, // multiplicador de xp ganho
    decay: { // inatividade diminui seu xp
        amountMin: 105,
        amountMax: 340,
        delay: 3600 * 3, // 3 horas de inatividade
        period: 3600 * 24, // a cada 5 horas
    },
    channels: {
        // mesa
        '213797930937745409': {
            multiplier: 1
        },
        // nsfw
        '318948034362736640': {
            multiplier: 0.2
        },
        // meme-spam
        '248932798713430017': {
            multiplier: 0.05
        },
        // mural
        '341395801093963787': {
            multiplier: 0
        },
    },
};

const STATS_TEMPLATE = {
    messageTotalCount: 0,
    messageTotalSize: 0,
    xp: 0,
    credits: 0,
    welcomeDate: null,

};

let timestamps = {};
let lastMessages = {};

class Exp {
    constructor () {}

    get modName() { return 'exp' }

    /**
     *
     * @param message
     */
    static onMessage(message) {
        // servidor fora do ar, nao contar xp
        if (!message.guild.available) return;

        const user = message.author;
        const channel = message.channel;

        // bots não ganham xp
        if (user.bot) return;

        console.log(`MESSAGE ${channel.name} ${user.username}`);
        const lastDuration = stopTiming(user, channel);

        const logChannel = message.guild.channels.get('392024446589730816');
        const config = getConfig(channel);

        let xp = config.gain.min + (Math.random() * (config.gain.max - config.gain.min));

        // passa pelo multiplicador
        xp *= config.multiplier;

        // conta quantas palavras por minuto a pessoa digitou
        const wordsCount = message.content.trim().split(/\s+/g).map(word => word.length > 2).length;
        const wpmMessage =
            // numero de palavras da mensagem, tirando as palavras com menos de 3 letras
            // dividido pela duracao da mensagem, em minutos
            lastDuration > 0
            ? (wordsCount / (lastDuration / (1000 * 60)))
            : 0
        ;

        if (wpmMessage < AVERAGE_WORD_PER_MINUTE_MIN || wpmMessage > AVERAGE_WORD_PER_MINUTE_MAX) {
            let min, max;
            if (wpmMessage < AVERAGE_WORD_PER_MINUTE_MIN) {
                min = parseInt(AVERAGE_WORD_PER_MINUTE_MIN * 0.5);
                max = AVERAGE_WORD_PER_MINUTE_MIN;
            } else {
                min = parseInt(AVERAGE_WORD_PER_MINUTE_MAX * 1.5);
                max = AVERAGE_WORD_PER_MINUTE_MAX;
            }

            // numero pelo qual, quando multiplicado, quanto mais perto do minimo, mais "zero" ele fica,
            // e quanto mais perto do maximo, mais "um" ele fica
            const penaltyWpmRatio = Math.min(1, Math.max(0, (wpmMessage - min) / (max - min)));

            // dá uma penalidade de xp por baixo/alto wpm
            xp *= penaltyWpmRatio;
        }

        logChannel.send(
            `Usuario ${user.username} ganhou ${xp} xp pelo canal ${channel.name}`
            + `\nUltima mensagem demorou ${lastDuration.toFixed(1)}ms`
            + `\nWPM: ${wpmMessage} - Palavras: ${wordsCount}`
            //+ `\n\`\`\`\n`+ JSON.stringify(config, null, 1) + `\n\`\`\``
        );
    }

    /**
     *
     * @param channel
     * @param user
     */
    static onTypingStart(channel, user) {
        console.log(`START TYPING ${channel.name} ${user.username}`);
        startTiming(user, channel);
    }

    /**
     *
     * @param channel
     * @param user
     */
    static onTypingStop(channel, user) {
        console.log(`STOP TYPING ${channel.name} ${user.username}`);
        pauseTiming(user, channel);
    }

    static events() {
        return {
            'message': Exp.onMessage,
            'typingStart': Exp.onTypingStart,
            'typingStop': Exp.onTypingStop,
        }
    }

    static countCommand(message, args) {
        const min = args[0];
        const max = args[1];
        const p = args[2];

        message.channel.send('Resultado: ' + ((p - min) / (max - min)));
    }

    static commands() {
        return {
            'count': Exp.countCommand
        }
    }
}

function startTiming(user, channel) {
    if (!timestamps[user.id + '-' + channel.id]) {
        timestamps[user.id + '-' + channel.id] = {
            start: 0,
            lastDuration: 0,
        };
    }
    // se passou mais do que 5 minutos, significa que a pessoa abandonou
    // aquela mensagem, entao começar de novo
    if (timestamps[user.id + '-' + channel.id].lastDuration > (1000 * 60 * 5)) {
        timestamps[user.id + '-' + channel.id].lastDuration = 0;
    }
    if (!timestamps[user.id + '-' + channel.id].start) {
        timestamps[user.id + '-' + channel.id].start = (new Date()).getTime();
    }
}

function pauseTiming(user, channel) {
    if (timestamps[user.id + '-' + channel.id]) {
        if (timestamps[user.id + '-' + channel.id].start) {
            const oldTs = timestamps[user.id + '-' + channel.id].start;
            timestamps[user.id + '-' + channel.id].start = 0;
            timestamps[user.id + '-' + channel.id].lastDuration += (new Date()).getTime() - oldTs;
        }
    }
}

function stopTiming(user, channel) {
    if (timestamps[user.id + '-' + channel.id]) {
        if (timestamps[user.id + '-' + channel.id].start) {
            const oldTs = timestamps[user.id + '-' + channel.id].start;
            timestamps[user.id + '-' + channel.id].start = 0;

            const lastDuration = timestamps[user.id + '-' + channel.id].lastDuration + (new Date()).getTime() - oldTs;
            timestamps[user.id + '-' + channel.id].lastDuration = 0;

            return lastDuration;
        }
        return timestamps[user.id + '-' + channel.id].lastDuration;
    }
    return 0;
}

function getConfig(channel) {
    return Object.assign({}, expConfig, expConfig.channels[channel.id] || {});
}

module.exports = Exp;