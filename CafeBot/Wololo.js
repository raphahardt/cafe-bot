
const fbAdmin = require("firebase-admin");
const fbServiceAccount = require("../misc/cafebot-2018-firebase-adminsdk-j17ic-a11e9f3222.json");
const utils = require('../utils');
const Discord = require("discord.js");
const ScoreboardManager = require("./Wololo/ScoreboardManager");

const fbApp = fbAdmin.initializeApp({
    credential: fbAdmin.credential.cert(fbServiceAccount),
    databaseURL: "https://cafebot-2018.firebaseio.com"
}, 'wololo');

const db = fbApp.database();
const ref = db.ref('wololo');

// quais cores estarão participando
// const colors = [
//     {
//         name: 'Azul',
//         plural: 'Azuis',
//         symbol: ':large_blue_circle:',
//         symbolStreak: ':blue_heart:',
//         count: 0
//     },
//     {
//         name: 'Vermelho',
//         plural: 'Vermelhos',
//         symbol: ':red_circle:',
//         symbolStreak: ':hearts:',
//         count: 0
//     },
// ];
const colors = [
    {
        name: 'Fogo',
        plural: 'Fogos',
        symbol: ':fire:',
        symbolStreak: ':fire:',
        count: 0
    },
    {
        name: 'Água',
        plural: 'Águas',
        symbol: ':ocean:',
        symbolStreak: ':ocean:',
        count: 0
    },
    {
        name: 'Vento',
        plural: 'Ventos',
        symbol: ':cloud_tornado:',
        symbolStreak: ':cloud_tornado:',
        count: 0
    },
    {
        name: 'Terra',
        plural: 'Terras',
        symbol: ':herb:',
        symbolStreak: ':herb:',
        count: 0
    },
];

// padrão
let MAX_CASTS = 4;
let DELAY_CASTS = 6; // em horas
let FAIL_CAST_CHANCE = 0.25;
let REFLECT_CAST_CHANCE = 0.15;
let EXITS = {};

ref.child('config').on('value', snapshot => {
    let config = snapshot.val();

    MAX_CASTS = config.maxCasts;
    DELAY_CASTS = config.delayCasts;
    FAIL_CAST_CHANCE = config.failCastChance;
    REFLECT_CAST_CHANCE = config.reflectCastChance;

});

ref.child('exits').on('value', snapshot => {
    EXITS = snapshot.val() || {};
});


/**
 * Algumas regras pro wololo:
 * - A pessoa só pode dar 2 wololos dentro de 24 horas
 * - A pessoa só pode brincar de wololo num canal específico, se ela mandar em outros canais
 * deletar a mensagem dela e mandar por DM pra ela não mandar naquele canal.
 * - Somente as pessoas que estão participando que vão brincar e participam das estatisticas
 * - As estatisticas ficarão fixadas no canal e o proprio bot vai ficar alterando esse topico
 * automaticamente
 * - Um wololo tem chances de falhar de 20%
 *
 */
class Wololo {
    constructor () {}

    static get name() { return 'wololo' }

    static wololoCommand(message, args) {
        //console.log('ROLES', message.guild.roles.array().map(r => `${r.id}: ${r.name}`));

        console.log('MAX_CASTS', MAX_CASTS);
        console.log('DELAY_CASTS', DELAY_CASTS);
        console.log('FAIL_CAST_CHANCE', FAIL_CAST_CHANCE);
        console.log('REFLECT_CAST_CHANCE', REFLECT_CAST_CHANCE);

        const arg = args.shift();
        switch (arg) {
            case 'exit':
                return Wololo.wololoExitCommand(message, args);
            case 'enter':
                return Wololo.wololoEnterCommand(message, args);
            case 'info':
            case 'i':
            case 'stats':
                return Wololo.wololoStatsCommand(message, args);
            case 'score':
                return Wololo.wololoScoreCommand(message, args);
            case 'scoreboard':
                return Wololo.wololoScoreboardCommand(message, args);
            default:
                if (message.mentions.users.size === 1) {
                    return Wololo.wololoConvertCommand(message, args);
                } else if (message.mentions.users.size > 1) {
                    message.reply(`:x: Apenas um usuário por ser convertido por vez.`);
                    return;
                }
                return Wololo.wololoMyColorCommand(message, args);
        }
    }

    static wololoMyColorCommand(message, args) {
        const user = message.mentions.users.size === 1 ? message.mentions.users.first() : message.author;

        if (user.bot) {
            message.reply(`:x: Bots não tem reino.`);
            return;
        }

        if (EXITS[user.id]) {
            message.reply(`:x: Esta pessoa não está participando do jogo. **Não converta ela.**`);
            return;
        }

        getInfo(user).then(info => {
            const colorSymbol = colors[info.color].symbol;
            message.reply(`Seu reino: ${colorSymbol}`);
        });
    }

    static wololoStatsCommand(message, args) {
        const user = message.mentions.users.size === 1 ? message.mentions.users.first() : message.author;

        if (user.bot) {
            message.reply(`:x: Bots não tem stats.`);
            return;
        }

        if (EXITS[user.id]) {
            message.reply(`:x: Esta pessoa não está participando do jogo. **Não converta ela.**`);
            return;
        }

        getInfo(user).then(info => {
            const now = parseInt((new Date()).getTime() / 1000);
            let stats = '';

            stats += `**Wololos bem sucedidos:** ${info.success}\n`;
            stats += `**Wololos falhos:** ${info.fail}\n`;

            const rating = parseInt((info.success / Math.max(info.success + info.fail, 1)) * 100);
            stats += `**Rating de sucesso:** ${rating}%\n`;
            stats += `**Escudos atuais:** ${info.shields}\n`;
            stats += `**Streak de wololos atual:** ${info.streak}\n`;
            // if (user.id === '208028185584074763' || user.id === '132137996995526656') {
            //     stats += `**Tempo como ${colors[info.color].name}:** Pra sempre\n`;
            // } else {
                for (let i = 0; i < colors.length; i++) {
                    let timeAs = info.timeAs[i] || 0;
                    if (i === info.color && info.timeAsTimestamps[i]) {
                        // conta o tempo que vc ta com a cor atual, pois ainda nao foi convertido pra saber
                        timeAs += now - info.timeAsTimestamps[i];
                    }
                    const timeAsFormatted = formatTime(timeAs);
                    stats += `**Tempo como ${colors[i].name}:** ${timeAsFormatted}\n`;
                }
            // }

            message.channel.send(`Stats de ${user} ${colors[info.color].symbol}:\n\n${stats}`);
        });
    }

    static wololoConvertCommand(message, args) {
        const user = message.author;
        const userToConvert = message.mentions.users.first();

        if (user.id === userToConvert.id) {
            message.reply(Math.random() > 0.9 ? `:x: aff eu convertendo` : `:x: Você não pode se converter!`);
            return;
        }

        if (userToConvert.bot) {
            message.reply(`:x: Você não pode converter um bot.`);
            return;
        }

        if (EXITS[userToConvert.id]) {
            message.reply(`:x: Esta pessoa não está participando do jogo. **Não converta ela.**`);
            return;
        }

        // if (userToConvert.id === '208028185584074763' || userToConvert.id === '132137996995526656') {
        //     message.reply(`:x: Você não pode converter os líderes da resistência!`);
        //     return;
        // }

        getInfo(user).then(info => {
            getInfo(userToConvert).then(convertInfo => {

                // verifica se o user tem wololo disponivel
                if (!hasWololo(info)) {
                    const timeLeft = getTimeLeftForNextWololo(info);
                    message.reply(`:x: Você não tem mais wololos por hoje. Volte em **${timeLeft}**.`);
                    return;
                }

                if (info.color === convertInfo.color) {
                    message.reply(`:x: Você já estão no mesmo time.`);
                    return;
                }

                const fail = (Math.random() * 3000) < (3000 * FAIL_CAST_CHANCE);
                const reflect = (Math.random() * 3000) < (3000 * (REFLECT_CAST_CHANCE * ((colors[convertInfo.color].count <= 3) ? 2 : 1)));
                let wasShielded = false;
                let wasReflected = false;

                // descarta um wololo e conta
                info.castsUsed++;
                if (!info.timestampCasts) info.timestampCasts = [];
                info.timestampCasts.push((new Date()).getTime());

                // verifica se ultrapassou o limite
                while (info.timestampCasts.length > MAX_CASTS) {
                    // vai tirando o cast mais antigo
                    info.timestampCasts.shift();
                }

                // converte o inimigo, se nao for fail
                if (!fail) {
                    // se tiver shield, perde o shield e nao a cor
                    if (convertInfo.shields > 0) {
                        convertInfo.shields--;
                        wasShielded = true;
                    } else {
                        if (reflect) {
                            // refletiu
                            wasReflected = true;

                            // contabiliza o tempo que ficou naquela cor
                            const now = parseInt((new Date()).getTime() / 1000);
                            if (!info.timeAs[info.color]) info.timeAs[info.color] = 0;
                            if (info.timeAsTimestamps[info.color]) {
                                info.timeAs[info.color] += now - info.timeAsTimestamps[info.color];
                            }
                            info.timeAsTimestamps[convertInfo.color] = now;
                            // fim da contabilização -----

                            // se não, converte mesmo
                            info.color = convertInfo.color;

                        } else {
                            // contabiliza o tempo que ficou naquela cor
                            const now = parseInt((new Date()).getTime() / 1000);
                            if (!convertInfo.timeAs[convertInfo.color]) convertInfo.timeAs[convertInfo.color] = 0;
                            if (convertInfo.timeAsTimestamps[convertInfo.color]) {
                                convertInfo.timeAs[convertInfo.color] += now - convertInfo.timeAsTimestamps[convertInfo.color];
                            }
                            convertInfo.timeAsTimestamps[info.color] = now;
                            // fim da contabilização -----

                            // se não, converte mesmo
                            convertInfo.color = info.color;
                        }
                    }

                    info.streak = (info.streak || 0) + 1;

                    if (info.streak >= 5) {
                        // a cada 5 streaks, ganha um shield
                        // if (user.id === '208028185584074763' || user.id === '132137996995526656') {
                        //     // os lideres da resistencia nao precisam de shields
                        // } else {
                            info.shields = (info.shields || 0) + 1;
                        // }
                        info.streak = 0;
                    }
                } else {
                    // perde o streak e o shield
                    info.streak = 0;
                }

                // contabiliza acertos e falhas
                const type = fail ? 'fail' : 'success';
                info[type] = (info[type] || 0) + 1;

                const replyMsg = replyWololoMessage(user, userToConvert, info, convertInfo, fail, wasShielded, wasReflected);
                message.reply(replyMsg);

                // salva as config dos users
                ref.child(`cores/${user.id}`).set(info);
                ref.child(`cores/${userToConvert.id}`).set(convertInfo);

            })
        });
    }

    static wololoScoreCommand(message, args) {

        loadScore().then((response) => {

            message.reply(`Placar rápido (**${response.totalMembers} participante(s)**):\n` + createFastScore(response.totalMembers));

        }).catch(console.error);
    }

    static wololoExitCommand(message, args) {
        const user = message.author;

        EXITS[user.id] = user.username;
        ref.child(`exits`).set(EXITS);
        ref.child(`cores/${user.id}`).set(null);

        message.reply(':white_check_mark: Você será ignorado pelo jogo.');
    }

    static wololoEnterCommand(message, args) {
        const user = message.author;

        delete EXITS[user.id];
        ref.child(`exits`).set(EXITS);

        message.reply(':white_check_mark: Você voltou ao jogo.');
    }

    static wololoScoreboardCommand(message, args) {

        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            message.reply(`:x: *Você não tem permissão pra isso.*`);
            return;
        }

        // deleta a mensagem do comando
        message.delete();
        const scoreboardManager = new ScoreboardManager(message.channel);

        loadScore().then(response => {
            let totalMembers = response.totalMembers;
            let members = response.members;

            // atualiza a primeira vez
            scoreboardManager.handle(generateScoreboardContent(
                message.guild, members, totalMembers
            ));

            const colorsRef = ref.child('cores');

            colorsRef.on('child_added', (snapshot, prevKey) => {
                console.log('added', snapshot.val());

                if (!members[snapshot.key]) {
                    const info = snapshot.val();
                    colors[info.color].count++;

                    totalMembers++;
                    members[snapshot.key] = info;

                    scoreboardManager.handle(generateScoreboardContent(
                        message.guild, members, totalMembers
                    ));
                }

            });

            // FIXME: como tratar uma alteração simples de cor se eu não tenho a referencia do que tava?
            // TODO: vai dar certo o jeito q eu fiz?
            colorsRef.on('child_changed', snapshot => {
                console.log('changed', snapshot.val());

                if (members[snapshot.key]) {
                    const info = snapshot.val();
                    const oldInfo = members[snapshot.key];

                    colors[info.color].count++;
                    colors[oldInfo.color].count--;

                    // atualiza com o novo
                    members[snapshot.key] = info;

                    scoreboardManager.handle(generateScoreboardContent(
                        message.guild, members, totalMembers
                    ));
                }
            });

            colorsRef.on('child_removed', snapshot => {
                console.log('removed', snapshot.val());

                if (members[snapshot.key]) {
                    const info = snapshot.val();
                    colors[info.color].count--;

                    totalMembers--;
                    delete members[snapshot.key];

                    scoreboardManager.handle(generateScoreboardContent(
                        message.guild, members, totalMembers
                    ));
                }
            });


        }).catch(console.error);
    }

    static commands() {
        return {
            'wololo': Wololo.wololoCommand,
        }
    }
}

function loadScore() {
    return new Promise((resolve, reject) => {
        const colorsRef = ref.child('cores');

        // zera os counts das cores primeiro
        for (let i = 0; i < colors.length; i++) {
            colors[i].count = 0;
        }

        colorsRef.once('value', (snapshot, prevKey) => {
            //console.log('value', snapshot.val());
            const allMembers = snapshot.val();

            if (!allMembers) {
                reject('no members');
                return;
            }

            // conta todos uma unica vez
            let count = 0;
            for (let id in allMembers) {
                if (!allMembers.hasOwnProperty(id)) continue;

                colors[allMembers[id].color].count++;
                count++;
            }

            resolve({ members: allMembers, totalMembers: count });
        });
    });
}

function createFastScore(totalMembers) {
    let colorScores = [];
    for (let i = 0; i < colors.length; i++) {
        //console.log('COUNT', i, colors[i].count, totalMembers);
        const score = parseInt((colors[i].count / totalMembers) * 100);
        colorScores.push(`${colors[i].symbol} ${score}% (${colors[i].count})`);
    }
    return colorScores.join(' :heavy_multiplication_x: ');
}

function replyWololoMessage(user, convertUser, info, convertInfo, fail, wasShielded, wasReflected) {
    let resultEmoji = '', message = '';
    const colorEmoji = colors[ info.color ].symbolStreak;
    const oldConvertUserColorEmoji = colors[ convertInfo.color ].symbol;
    const newConvertUserColorEmoji = colors[ info.color ].symbol;

    switch (true) {
        case wasReflected:
            resultEmoji = ':repeat:';
            message = `**${convertUser} refletiu!** ${user} agora é ${oldConvertUserColorEmoji}`;
            break;
        case wasShielded:
            resultEmoji = ':shield:';
            message = `**Usou escudo!** ${convertUser} continua ${oldConvertUserColorEmoji}`;
            break;
        case fail:
            resultEmoji = ':heavy_multiplication_x:';
            message = `**Falhou!** ${convertUser} continua ${oldConvertUserColorEmoji}`;
            break;
        default:
            resultEmoji = ':white_check_mark:';
            message = `**Sucesso!** ${convertUser} agora é ${newConvertUserColorEmoji}`;
            break;
    }

    //const emojiText = `:speaking_head:  \\--{ *wololo* }  :wavy_dash:${colorEmoji}:wavy_dash:${colorEmoji}:wavy_dash:${resultEmoji}`;
    const emojiText = `:speaking_head:     :wavy_dash:${colorEmoji}:wavy_dash:${colorEmoji}:wavy_dash:${resultEmoji}`;

    return `\n${emojiText}\n\n${message}`;

}

function generateColor(user) {
    // if (user.id === '208028185584074763') {
    //     return 1; // sempre vermelho pra mim
    // } else if (user.id === '132137996995526656') {
    //     return 0; // sempre azul pra dani
    // }

    const threshold = 50000 / colors.length;
    // let factor = utils.seededRandom(user.discriminator) * 50000;
    let factor = Math.random() * 50000;

    console.log('fator e thrs', factor, threshold);

    let quad = -1;

    while (factor > 0) {
        quad++;
        factor -= threshold;
    }

    if (quad < 0 || quad >= colors.length) {
        throw new Error(`O fator ${factor} retornou ${quad} pro usuário ${user.username}`);
    }

    return quad;
}

function getInfo(user) {
    return new Promise((resolve, reject) => {
        const coreUserRef = ref.child(`cores/${user.id}`);

        coreUserRef.once('value', snapshot => {
            let info = snapshot.val();

            if (!info) {
                const generatedColor = generateColor(user);
                let timeAs = {}, timeAsTimestamps = {};

                for (let i = 0; i < colors.length; i++) {
                    timeAs[i] = 0;
                    timeAsTimestamps[i] = 0;
                }

                // coloca a primeira cor no timestamp
                timeAsTimestamps[generatedColor] = parseInt((new Date()).getTime() / 1000);

                info = {
                    color: generatedColor,
                    timestampCasts: [],
                    castsUsed: 0,
                    shields: 0,
                    streak: 0,
                    success: 0,
                    fail: 0,
                    timeAs: timeAs,
                    timeAsTimestamps: timeAsTimestamps,
                };
                // salva o que foi definido, se ele não tiver
                coreUserRef.set(info);
            }

            resolve(info);
        });
    });
}

function hasWololo(info) {
    for (let i = 0; i < MAX_CASTS; i++) {
        const time = (info.timestampCasts || [])[i];

        // se nao tem horario, entao ele tem slot
        if (!time) {
            console.log('HASWOLOLO', 'não achei time, true');
            return true;
        }

        // se o horario que foi feito o wololo + 24 horas foi
        // antes do horario atual, entao ele tem wololo
        console.log('HASWOLOLO', time, (new Date()).getTime());
        if (time + (DELAY_CASTS * 3600000) < (new Date()).getTime()) {
            return true;
        }
    }

    console.log('HASWOLOLO', 'false');
    return false;
}

function getTimeLeftForNextWololo(info) {
    const oldestTimestampCast = info.timestampCasts.slice().sort();
    let diffSeconds = (DELAY_CASTS * 3600) - ((new Date()).getTime() - oldestTimestampCast[0]) / 1000;

    return formatTime(diffSeconds);
}

function formatTime(seconds) {
    if (seconds > 3600) {
        const minutes = parseInt((seconds % 3600) / 60);
        const minutesText = minutes > 0 ? ` e ${minutes} minuto(s)` : '';
        return parseInt(seconds / 3600) + ' hora(s)' + minutesText;
    }

    if (seconds > 60) {
        return parseInt(seconds / 60) + ' minuto(s)';
    }

    return parseInt(seconds) + ' segundo(s)';
}

/**
 *
 * @param {?Discord.Guild} guild
 * @param members
 * @param totalMembers
 * @return {string}
 */
function generateScoreboardContent(guild, members, totalMembers) {
    if (!guild) return '[ Placar não está numa guild válida ]';

    let content = [];
    content.push(`**Participantes:** ${totalMembers}\n\n`);

    for (let id in members) {
        if (!members.hasOwnProperty(id)) continue;
        const m = members[id];

        const colorEmoji = m.streak > 5 ? colors[m.color].symbolStreak : colors[m.color].symbol;
        const userName = guild.members.get(id).user.username;
        const shieldEmoji = m.shields > 0 ? ` **${m.shields}** :shield:` : '';
        const streakEmojis = m.streak > 0 ? ':small_orange_diamond:'.repeat(m.streak) + `` : '';
        const leaderEmoji = /*id === '208028185584074763' || id === '132137996995526656' ? `:crown: ` : */'';

        content.push(`${colorEmoji} ${leaderEmoji}${userName}${streakEmojis}\n`);
    }

    content.push(`\n` + createFastScore(totalMembers));

    const lastUpdate = (new Date()).toLocaleString();
    content.push(`\n\n*última atualização: ${lastUpdate}*`);

    return content;
}

function logEvent(event) {
    const logRef = ref.child(`log`);
    logRef.push().set({ event: event, ts: new Date() });
}

module.exports = Wololo;