
const fbAdmin = require("firebase-admin");
const fbServiceAccount = require("../misc/cafebot-2018-firebase-adminsdk-j17ic-a11e9f3222.json");
const utils = require('../utils');
const Discord = require("discord.js");

const fbApp = fbAdmin.initializeApp({
    credential: fbAdmin.credential.cert(fbServiceAccount),
    databaseURL: "https://cafebot-2018.firebaseio.com"
});

const db = fbApp.database();
const ref = db.ref('wololo');

// quais cores estarão participando
const colors = [
    {
        name: 'Azul',
        plural: 'Azuis',
        symbol: ':large_blue_circle:',
        symbolStreak: ':blue_heart:',
        count: 0
    },
    {
        name: 'Vermelho',
        plural: 'Vermelhos',
        symbol: ':red_circle:',
        symbolStreak: ':hearts:',
        count: 0
    },
];

const MAX_WOLOLOS = 2;


/**
 * Algumas regras pro wololo:
 * - A pessoa só pode dar 2 wololos dentro de 24 horas
 * - A pessoa só pode brincar de wololo num canal específico, se ela mandar em outros canais
 * deletar a mensagem dela e mandar por DM pra ela não mandar naquele canal.
 * - Somente as pessoas que estão participando que vão brincar e participam das estatisticas
 * - As estatisticas ficarão fixadas no canal e o proprio bot vai ficar alterando esse topico
 * automaticamente
 * - Um wololo tem chances de falhar de 30%
 *
 */
class Wololo {
    constructor () {}

    static get name() { return 'wololo' }

    static wololoCommand(message, args) {
        //console.log('ROLES', message.guild.roles.array().map(r => `${r.id}: ${r.name}`));
        const arg = args.shift();
        switch (arg) {
            case 'score':
            case 's':
                return Wololo.wololoScoreCommand(message, args);
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
        const user = message.author;

        getInfo(user).then(info => {
            const colorSymbol = colors[info.color].symbol;
            message.reply(`Sua cor: ${colorSymbol}`);
        });
    }

    static wololoConvertCommand(message, args) {
        const user = message.author;
        const userToConvert = message.mentions.users.first();

        if (user.id === userToConvert.id) {
            message.reply(Math.random() > 0.9 ? `:x: aff eu convertendo` : `:x: Você não pode se converter!`);
            return;
        }

        getInfo(user).then(info => {
            getInfo(userToConvert).then(convertInfo => {

                // verifica se o user tem wololo disponivel
                if (!hasWololo(info)) {
                    const timeLeft = getTimeLeftForNextWololo(info);
                    message.reply(`:x: Você não tem mais wololos por hoje. Volte em ${timeLeft}.`);
                    return;
                }

                if (info.color === convertInfo.color) {
                    message.reply(`:x: Você já estão no mesmo time.`);
                    return;
                }
            })
        });
    }

    static wololoScoreCommand(message, args) {
        if (initialized) {
            return;
        }

        message.channel.send('Carregando placar...').then(msg => {
            const colorsRef = ref.child('cores');

            colorsRef.once('value', (snapshot, prevKey) => {
                console.log('value', snapshot.val());
                const allMembers = snapshot.val();

                if (!allMembers) {
                    msg.edit(generateScoreboardContent());
                    return;
                }

                // conta todos uma unica vez
                for (let id in allMembers) {
                    if (!allMembers.hasOwnProperty(id)) continue;

                    colors[ allMembers[id] ].count++;
                }

                msg.edit(generateScoreboardContent());

                initialized = true;
            });

            colorsRef.on('child_added', (snapshot, prevKey) => {
                console.log('added', snapshot.val());
                const color = snapshot.val();
                colors[color].count++;

                msg.edit(generateScoreboardContent());
            });

            // FIXME: como tratar uma alteração simples de cor se eu não tenho a referencia do que tava?
            colorsRef.on('child_changed', snapshot => {
                console.log('changed', snapshot.val());
            });

            colorsRef.on('child_removed', snapshot => {
                console.log('removed', snapshot.val());
                const color = snapshot.val();
                colors[color].count--;

                msg.edit(generateScoreboardContent());
            });

        }).catch(console.error);
    }

    static commands() {
        return {
            'wololo': Wololo.wololoCommand,
        }
    }
}

function generateColor(user) {
    const threshold = 5000 / colors.length;
    let factor = utils.seededRandom(user.discriminator) * 5000;

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
                info = {
                    color: generateColor(user),
                    timestampCasts: [],
                    castsUsed: 0,
                };
                // salva o que foi definido, se ele não tiver
                coreUserRef.set(info);
            }

            resolve(info);
        });
    });
}

function hasWololo(info) {
    for (let i = 0; i < MAX_WOLOLOS; i++) {
        const time = (info.timestampCasts || [])[i];

        // se nao tem horario, entao ele tem slot
        if (!time) {
            return true;
        }

        // se o horario que foi feito o wololo + 24 horas foi
        // antes do horario atual, entao ele tem wololo
        if (time + 86400 < (new Date()).getTime()) {
            return true;
        }
    }

    return false;
}

function getTimeLeftForNextWololo(info) {
    const oldestTimestampCast = info.timestampCasts.slice().sort();
    let diffSeconds = (new Date()).getTime() - oldestTimestampCast;

    if (diffSeconds > 3600) {
        return parseInt(diffSeconds / 3600) + ' hora(s)';
    }

    if (diffSeconds > 60) {
        return parseInt(diffSeconds / 60) + ' minuto(s)';
    }

    return (diffSeconds) + ' segundo(s)';
}

function generateScoreboardContent() {
    let content = "**PLACAR WOLOLO**:\n";
    content += `\`\`\`${blockquoteLang}\n`;

    let sum = 0;
    for (let i = 0; i < colors.length; i++) {
        sum += colors[i].count;
    }

    for (let i = 0; i < colors.length; i++) {
        content += colors[i].symbol + colors[i].plural + ":\n";
        content += colors[i].count;
        content += ' (' + parseInt((colors[i].count / Math.max(1, sum)) * 100) + '%)';
        content += "\n";
    }

    content += `\`\`\``;

    return content;
}

function logEvent(event) {
    const logRef = ref.child(`log`);
    logRef.push().set({ event: event, ts: new Date() });
}

module.exports = Wololo;