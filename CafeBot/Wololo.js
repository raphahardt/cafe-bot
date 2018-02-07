
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
                return Sorteio.giveawayCreateCommand(message, args);
            default:
                return Sorteio.wololoMyColorCommand(message, args);
        }
    }

    static pingCommand(message, args) {
        const userId = message.author.id;

        let rand;
        const coreUserRef = ref.child(`cores/${userId}`);

        coreUserRef.once('value', snapshot => {
            let rand = snapshot.val();

            if (!rand) {
                rand = generateColor(message.author);
                // salva o que foi definido, se ele não tiver
                coreUserRef.set(rand);
            }

            message.reply(`Sua cor: ${rand}`);
            // generateScoreboardContent().then(content => {
            //     message.channel.send(content);
            // }).catch(console.error);
        });
    }

    static initCommand(message, args) {
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
            'my': Wololo.pingCommand,
            'init': Wololo.initCommand,
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