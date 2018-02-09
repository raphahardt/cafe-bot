
const fbAdmin = require("firebase-admin");
const fbServiceAccount = require("../misc/cafebot-2018-firebase-adminsdk-j17ic-a11e9f3222.json");
const utils = require('../utils');
const Discord = require("discord.js");

const fbApp = fbAdmin.initializeApp({
    credential: fbAdmin.credential.cert(fbServiceAccount),
    databaseURL: "https://cafebot-2018.firebaseio.com"
}, 'sorteio');

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
            case 'list':
            case 'l':
                return Sorteio.giveawayListCommand(message, args);
            case 'cancel':
            case 'c':
                return Sorteio.giveawayCancelCommand(message, args);
            default:
                return Sorteio.giveawayParticipateCommand(message, args);
        }
    }

    static giveawayCreateCommand(message, args) {

        // verifica se é um admin para encerrar um giveaway
        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            message.reply(`:x: *Você não tem permissão de criar um sorteio.*`);
            return;
        }

        const gamesCount = parseInt(args.shift());
        const giveawayName = args.shift();
        const gameNamesList = args;

        if (gamesCount === 0 || !giveawayName || gameNamesList.length === 0 || gameNamesList.length !== gamesCount) {
            message.channel.send(`Modo de usar: \`+giveaway (start | s) [numero de jogos] "[nome do giveaway]" "[nome do jogo 1]" "[nome do jogo 2...]" \`
Inicia um giveaway.

  **Exemplo:**
\`\`\`+giveaway start 2 "Sorteio de dois jogos!" "Jogo 1" "Jogo 2"
+giveaway s 1 "Sorteio de Overwatch" "Overwatch"\`\`\``);
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
                creator: message.author.id,
                gameNames: gameNamesList,
                name: giveawayName
            });
            // reseta todos os participantes
            ref.child(`lista`).set({});

            message.reply(`:white_check_mark: Sorteio \`${giveawayName}\` criado.`);
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

        // verifica se é um admin para encerrar um giveaway
        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            message.reply(`:x: *Você não tem permissão de encerrar um sorteio.*`);
            return;
        }

        let giveInfo;
        const giveRef = ref.child(`atual`);

        giveRef.once('value', snapshot => {
            giveInfo = snapshot.val();

            if (!giveInfo) {
                message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                return;
            }

            if (giveInfo.creator !== message.author.id) {
                message.reply(`:x: Somente o criador do giveaway pode encerra-lo.`);
                return;
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
                    const idx = winners.indexOf(m);
                    return `Prêmio *${giveInfo.gameNames[idx]}*: ${m}`;
                    // if (!m.nickname) {
                    //     return `${m.user.username}#${m.user.discriminator}`;
                    // }
                    // return m.nickname + ` (${m.user.username}#${m.user.discriminator})`;
                }).map(n => `:small_blue_diamond: ${n}`).join("\n");

                const content = `:trophy: **Resultados do sorteio \`${giveInfo.name}\`**
Vencedores:
${winnersList}`;
                message.channel.send(content).then(msg => {
                    // enviou a mensagem, entao agora posso apagar o giveaway atual
                    giveRef.set(null);
                }).catch(console.error);

            });

            // coloca o participante na lista
            //ref.child(`lista/${userId}`).set(1);

        });
    }

    static giveawayCancelCommand(message, args) {

        // verifica se é um admin para encerrar um giveaway
        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            message.reply(`:x: *Você não tem permissão de encerrar um sorteio.*`);
            return;
        }

        let giveInfo;
        const giveRef = ref.child(`atual`);

        giveRef.once('value', snapshot => {
            giveInfo = snapshot.val();

            if (!giveInfo) {
                message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                return;
            }

            if (giveInfo.creator !== message.author.id) {
                message.reply(`:x: Somente o criador do giveaway pode cancela-lo.`);
                return;
            }

            giveRef.set(null);
            message.reply(`:white_check_mark: Sorteio \`${giveInfo.name}\` cancelado.`);

        });

    }

    static giveawayListCommand(message, args) {

        let giveInfo;
        const giveRef = ref.child(`atual`);

        giveRef.once('value', snapshot => {
            giveInfo = snapshot.val();

            if (!giveInfo) {
                message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                return;
            }

            ref.child(`lista`).once('value', sn => {
                const keys = Object.keys(sn.val() || {});

                if (keys.length === 0) {
                    message.reply(`:x: Não há nenhum participante no sorteio \`${giveInfo.name}\`.`);
                    return;
                }

                console.log(keys);

                let ticketsCounts = {};
                let minBound = 0, maxBound;

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

                console.log('TICKETS', ticketsCounts);

                let tickets = [];
                for (let userId in ticketsCounts) {
                    tickets.push(message.guild.members.get(userId));
                }

                const ticketsList = tickets.map(m => {
                    if (!m.nickname) {
                        return `${m.user.username}#${m.user.discriminator}`;
                    }
                    return m.nickname + ` (${m.user.username}#${m.user.discriminator})`;
                }).map(n => `:small_blue_diamond: ${n}`).join("\n");

                message.reply(`Participantes do sorteio \`${giveInfo.name}\`
${ticketsList}`);

            });

        });

    }

    static commands() {
        return {
            'giveaway': Sorteio.giveawayCommand,
        }
    }
}

module.exports = Sorteio;