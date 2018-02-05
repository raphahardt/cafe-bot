
const fbAdmin = require("firebase-admin");
const fbServiceAccount = require("../misc/cafebot-2018-firebase-adminsdk-j17ic-a11e9f3222.json");
const utils = require('../utils');
const Discord = require("discord.js");

const fbApp = fbAdmin.initializeApp({
    credential: fbAdmin.credential.cert(fbServiceAccount),
    databaseURL: "https://cafebot-2018.firebaseio.com"
});

const db = fbApp.database();
const ref = db.ref('sorteio');

const leveledRoles = [
    '240282044209299457', // level 0
    '240282632787591169', // level 1
    '240287430874365962', // level 2
    '240287655907164162', // level 3
    '240287808864911363', // level 4
    '316927077318393856', // level 5
];

/**
 *
 *
 */
class Sorteio {
    constructor () {}

    static get name() { return 'sorteio' }

    static giveawayCommand(message, args) {
        //console.log('ROLES', message.guild.roles.array().map(r => `${r.id}: ${r.name}`));
        const arg = args.shift();
        switch (arg) {
            case 'start':
            case 's':
                return Sorteio.giveawayCreateCommand(message, args);
            case 'end':
            case 'e':
                return Sorteio.giveawayEndCommand(message, args);
            default:
                return Sorteio.giveawayParticipateCommand(message, args);
        }
    }

    static giveawayCreateCommand(message, args) {
        const gamesCount = parseInt(args.shift());
        const giveawayName = args.join(' ');

        if (gamesCount === 0) {
            message.channel.send(`Modo de usar: \`+giveaway (start | s) [numero de jogos] [nome do giveaway]\`
Inicia um giveaway.

  **Exemplo:**
\`\`\`+giveaway start 2 Sorteio de dois jogos!
+giveaway s 1 Sorteio de Overwatch\`\`\``);
            return;
        }

        const giveRef = ref.child(`atual`);

        giveRef.once('value', snapshot => {
            let giveInfo = snapshot.val();

            if (giveInfo) {
                message.reply(`:x: Já existe um sorteio em andamento.`);
                return;
            }

            giveRef.set({
                games: parseInt(gamesCount),
                name: giveawayName
            });
            // reseta todos os participantes
            ref.child(`lista`).set({});
        });
    }

    static giveawayParticipateCommand(message, args) {
        const userId = message.author.id;

        let giveInfo;
        const giveRef = ref.child(`atual`);

        giveRef.once('value', snapshot => {
            giveInfo = snapshot.val();

            if (!giveInfo) {
                message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                return;
            }

            if (!message.member.roles.some(r => leveledRoles.includes(r.id))) {
                const minimumLevel = message.guild.roles.get(leveledRoles[0]);
                message.reply(`:x: Você precisa ter pelo menos o nível \`${minimumLevel.name}\` para participar.`);
                return;
            }

            ref.child(`lista/${userId}`).once('value', sn => {
                if (sn.val()) {
                    message.reply(`:thumbsup: Você já está participando do sorteio \`${giveInfo.name}\`.`);
                } else {
                    // coloca o participante na lista
                    ref.child(`lista/${userId}`).set(1);

                    message.reply(`:white_check_mark: Participação confirmada no sorteio \`${giveInfo.name}\`.`);
                }
            });



        });
    }

    static giveawayEndCommand(message, args) {

        let giveInfo;
        const giveRef = ref.child(`atual`);

        giveRef.once('value', snapshot => {
            giveInfo = snapshot.val();

            if (!giveInfo) {
                message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
            }

            ref.child(`lista`).once('value', sn => {
                const keys = utils.shuffle(Object.keys(sn.val() || {}));
                let gameCount = giveInfo.games;

                if (keys.length === 0) {
                    message.reply(`:x: Não há nenhum participante no sorteio \`${giveInfo.name}\`.`);
                    return;
                }

                if (keys.length < gameCount) {
                    message.reply(`:x: Não há participantes suficientes pro sorteio \`${giveInfo.name}\`. Necessitam pelo menos ${gameCount} (tem ${keys.length}).`);
                    return;
                }

                console.log(keys);

                let ticketsCounts = {};
                let minBound = 0, maxBound, maxShuffle = 0;

                for (let i = 0; i < keys.length; i++) {
                    let userId = keys[i];
                    let ticketCount = 100;

                    const mbr = message.guild.members.get(userId);
                    mbr.roles.array().forEach(role => {
                        if (leveledRoles.includes(role.id)) {
                            // a cada role que o usuario tiver ele ganha 5% a mais de chance de ganhar
                            ticketCount *= 1.05;
                        }
                    });

                    maxBound = parseInt(ticketCount);
                    ticketsCounts[userId] = [ minBound, minBound + maxBound, maxBound ];

                    minBound += maxBound;
                }
                maxShuffle = minBound + maxBound;

                console.log('TICKETS', ticketsCounts);

                let winners = [];

                while (gameCount) {
                    const luckyNumber = parseInt(Math.random() * maxShuffle);
                    console.log('LUCKY NUMBER', luckyNumber);

                    let winner;

                    for (let userId in ticketsCounts) {
                        if (luckyNumber >= ticketsCounts[userId][0] && luckyNumber < ticketsCounts[userId][1]) {
                            // sorteado
                            winner = message.guild.members.get(userId);
                        }
                    }

                    if (!winner || winners.includes(winner)) {
                        // se não teve ganhador, ou o ganhador já ganhou
                        // tenta sortear de novo
                        continue;
                    }

                    // coloca nos ganhadores
                    winners.push(winner);

                    gameCount--;
                }

                const winnersList = winners.map(m => {
                    if (!m.nickname) {
                        return `${m.user.username}#${m.user.discriminator}`;
                    }
                    return m.nickname + ` (${m.user.username}#${m.user.discriminator})`;
                }).map(n => `:small_blue_diamond: ${n}`).join("\n");

                message.reply(`:trophy: **Resultados do sorteio \`${giveInfo.name}\`
${winnersList}
`);


            });

            // coloca o participante na lista
            //ref.child(`lista/${userId}`).set(1);

        });
    }

    static commands() {
        return {
            'giveaway': Sorteio.giveawayCommand,
        }
    }
}

module.exports = Sorteio;