
const utils = require('../utils');
const Discord = require("discord.js");
const Cafebase = require('./Cafebase');

const PermissionError = require('./Errors/PermissionError');

const adminsIds = require('../adminIds');

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
    constructor () {
        this.db = new Cafebase('sorteio');
    }

    get modName() { return 'sorteio' }

    giveawayCommand(message, args) {
        const arg = args.shift();
        switch (arg) {
            case 'start':
            case 's':
                return this.giveawayCreateCommand(message, args);
            case 'end':
            case 'e':
                return this.giveawayEndCommand(message, args);
            case 'list':
            case 'l':
                return this.giveawayListGamesCommand(message, args);
            case 'cancel':
            case 'c':
                return this.giveawayCancelCommand(message, args);
            case 'who':
            case 'w':
                return this.giveawayListParticipantsCommand(message, args);
            default:
                return this.giveawayParticipateCommand(message, args);
        }
    }

    giveawayCreateCommand(message, args) {
        // verifica se é um admin para criar um giveaway
        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            throw new PermissionError(`Você não tem permissão de criar um sorteio.`);
        }

        const gamesCount = parseInt(args.shift());
        const giveawayName = args.shift();
        const gameNamesList = args;

        if (gamesCount === 0 || !giveawayName || gameNamesList.length === 0 || gameNamesList.length !== gamesCount) {
            return message.reply(`Modo de usar: \`+giveaway (start | s) [numero de jogos] "[nome do giveaway]" "[nome do jogo 1]" "[nome do jogo 2...]" \`
Inicia um giveaway.

  **Exemplo:**
\`\`\`+giveaway start 2 "Sorteio de dois jogos!" "Jogo 1" "Jogo 2"
+giveaway s 1 "Sorteio de Overwatch" "Overwatch"\`\`\``);
        }

        return this.db.getOne('atual')
            .then(giveInfo => {
                if (giveInfo) {
                    return message.reply(`:x: Já existe um sorteio em andamento.`);
                }

                const info = {
                    games: parseInt(gamesCount),
                    creator: message.author.id,
                    gameNames: gameNamesList,
                    name: giveawayName
                };

                return this.db.saveAll(['atual', info, 'lista', null])
                    .then(() => {
                        return message.reply(`:white_check_mark: Sorteio \`${giveawayName}\` criado.`);
                    })
                ;
            })
        ;

        // const giveRef = ref.child(`atual`);
        //
        // giveRef.once('value', snapshot => {
        //     let giveInfo = snapshot.val();
        //
        //     if (giveInfo) {
        //         message.reply(`:x: Já existe um sorteio em andamento.`);
        //         return;
        //     }
        //
        //     giveRef.set({
        //         games: parseInt(gamesCount),
        //         creator: message.author.id,
        //         gameNames: gameNamesList,
        //         name: giveawayName
        //     });
        //     // reseta todos os participantes
        //     ref.child(`lista`).set({});
        //
        //     message.reply(`:white_check_mark: Sorteio \`${giveawayName}\` criado.`);
        // });
    }

    giveawayParticipateCommand(message, args) {
        const userId = message.author.id;

        return this.db.getOne('atual')
            .then(giveInfo => {
                if (!giveInfo) {
                    return message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                }

                if (!message.member.roles.some(r => leveledRoles.includes(r.id))) {
                    const minimumLevel = message.guild.roles.get(leveledRoles[0]);
                    return message.reply(`:x: Você precisa ter pelo menos o nível \`${minimumLevel.name}\` para participar.`);
                }

                return this.db.getOne('lista/' + userId)
                    .then(participant => {
                        if (participant) {
                            return message.reply(`:thumbsup: Você já está participando do sorteio \`${giveInfo.name}\`.`);
                        } else {
                            // coloca o participante na lista
                            return this.db.save('lista/' + userId, 1)
                                .then(() => {
                                    return message.reply(`:white_check_mark: Participação confirmada no sorteio \`${giveInfo.name}\`.`);
                                })
                            ;
                        }
                    })
                ;
            })
        ;

        // let giveInfo;
        // const giveRef = ref.child(`atual`);
        //
        // giveRef.once('value', snapshot => {
        //     giveInfo = snapshot.val();
        //
        //     if (!giveInfo) {
        //         message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
        //         return;
        //     }
        //
        //     if (!message.member.roles.some(r => leveledRoles.includes(r.id))) {
        //         const minimumLevel = message.guild.roles.get(leveledRoles[0]);
        //         message.reply(`:x: Você precisa ter pelo menos o nível \`${minimumLevel.name}\` para participar.`);
        //         return;
        //     }
        //
        //     ref.child(`lista/${userId}`).once('value', sn => {
        //         if (sn.val()) {
        //             message.reply(`:thumbsup: Você já está participando do sorteio \`${giveInfo.name}\`.`);
        //         } else {
        //             // coloca o participante na lista
        //             ref.child(`lista/${userId}`).set(1);
        //
        //             message.reply(`:white_check_mark: Participação confirmada no sorteio \`${giveInfo.name}\`.`);
        //         }
        //     });
        //
        //
        //
        // });
    }

    giveawayEndCommand(message, args) {

        // verifica se é um admin para encerrar um giveaway
        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            throw new PermissionError(`Você não tem permissão de encerrar um sorteio.`);
        }

//         let giveInfo;
//         const giveRef = ref.child(`atual`);
//
//         giveRef.once('value', snapshot => {
//             giveInfo = snapshot.val();
//
//             if (!giveInfo) {
//                 message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
//                 return;
//             }
//
//             if (giveInfo.creator !== message.author.id) {
//                 message.reply(`:x: Somente o criador do giveaway pode encerra-lo.`);
//                 return;
//             }
//
//             ref.child(`lista`).once('value', sn => {
//                 const keys = utils.shuffle(Object.keys(sn.val() || {}));
//                 let gameCount = giveInfo.games;
//
//                 if (keys.length === 0) {
//                     message.reply(`:x: Não há nenhum participante no sorteio \`${giveInfo.name}\`.`);
//                     return;
//                 }
//
//                 if (keys.length < gameCount) {
//                     message.reply(`:x: Não há participantes suficientes pro sorteio \`${giveInfo.name}\`. Necessitam pelo menos ${gameCount} (tem ${keys.length}).`);
//                     return;
//                 }
//
//                 console.log(keys);
//
//                 let ticketsCounts = {};
//                 let minBound = 0, maxBound, maxShuffle = 0;
//
//                 for (let i = 0; i < keys.length; i++) {
//                     let userId = keys[i];
//                     let ticketCount = 100;
//
//                     if (!adminsIds.includes(userId)) {
//                         const mbr = message.guild.members.get(userId);
//                         mbr.roles.array().forEach(role => {
//                             if (leveledRoles.includes(role.id)) {
//                                 // a cada role que o usuario tiver ele ganha 5% a mais de chance de ganhar
//                                 ticketCount *= 1.05;
//                             }
//                         });
//                     }
//
//                     maxBound = parseInt(ticketCount);
//                     ticketsCounts[userId] = [ minBound, minBound + maxBound, maxBound ];
//
//                     minBound += maxBound;
//                 }
//                 maxShuffle = minBound + maxBound;
//
//                 console.log('TICKETS', ticketsCounts);
//
//                 let winners = [];
//                 let luckyNumbers = [];
//
//                 while (gameCount) {
//                     const luckyNumber = parseInt(Math.random() * maxShuffle);
//                     console.log('LUCKY NUMBER', luckyNumber);
//
//                     let winner;
//
//                     for (let userId in ticketsCounts) {
//                         if (luckyNumber >= ticketsCounts[userId][0] && luckyNumber < ticketsCounts[userId][1]) {
//                             // sorteado
//                             winner = message.guild.members.get(userId);
//                         }
//                     }
//
//                     if (!winner || winners.includes(winner)) {
//                         // se não teve ganhador, ou o ganhador já ganhou
//                         // tenta sortear de novo
//                         continue;
//                     }
//
//                     // coloca nos ganhadores
//                     winners.push(winner);
//                     luckyNumbers.push(luckyNumber);
//
//                     gameCount--;
//                 }
//
//                 const winnersList = winners.map(m => {
//                     const idx = winners.indexOf(m);
//                     return `Prêmio *${giveInfo.gameNames[idx]}*: ${m} *[ticket: ${luckyNumbers[idx]}]*`;
//                     // if (!m.nickname) {
//                     //     return `${m.user.username}#${m.user.discriminator}`;
//                     // }
//                     // return m.nickname + ` (${m.user.username}#${m.user.discriminator})`;
//                 }).map(n => `:small_blue_diamond: ${n}`).join("\n");
//
//                 const content = `:trophy: **Resultados do sorteio \`${giveInfo.name}\`**
// Vencedores:
// ${winnersList}`;
//                 message.channel.send(content).then(msg => {
//                     // enviou a mensagem, entao agora posso apagar o giveaway atual
//                     giveRef.set(null);
//                 }).catch(console.error);
//
//             });
//
//             // coloca o participante na lista
//             //ref.child(`lista/${userId}`).set(1);
//
//         });
    }

    giveawayCancelCommand(message, args) {
        // verifica se é um admin para encerrar um giveaway
        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            throw new PermissionError(`Você não tem permissão de cancelar um sorteio.`);
        }

        return this.db.getOne('atual')
            .then(giveInfo => {
                if (!giveInfo) {
                    return message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                }

                if (giveInfo.creator !== message.author.id) {
                    return message.reply(`:x: Somente o criador do giveaway pode cancelá-lo.`);
                }

                return this.db.save('atual', null)
                    .then(() => {
                        return message.reply(`:white_check_mark: Sorteio \`${giveInfo.name}\` cancelado.`);
                    })
                    ;
            })
            ;

        // let giveInfo;
        // const giveRef = ref.child(`atual`);
        //
        // giveRef.once('value', snapshot => {
        //     giveInfo = snapshot.val();
        //
        //     if (!giveInfo) {
        //         message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
        //         return;
        //     }
        //
        //     if (giveInfo.creator !== message.author.id) {
        //         message.reply(`:x: Somente o criador do giveaway pode cancela-lo.`);
        //         return;
        //     }
        //
        //     giveRef.set(null);
        //     message.reply(`:white_check_mark: Sorteio \`${giveInfo.name}\` cancelado.`);
        //
        // });

    }

    giveawayListGamesCommand(message, args) {
        return this.db.getOne('atual')
            .then(giveInfo => {
                if (!giveInfo) {
                    return message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                }

                const gamesList = giveInfo.gameNames.map(n => `:small_blue_diamond: :video_game: ${n}`).join("\n");
                return message.reply(`Lista de jogos do sorteio \`${giveInfo.name}\`\n${gamesList}`);
            })
            ;
//         let giveInfo;
//         const giveRef = ref.child(`atual`);
//
//         giveRef.once('value', snapshot => {
//             giveInfo = snapshot.val();
//
//             if (!giveInfo) {
//                 message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
//                 return;
//             }
//
//             const gamesList = giveInfo.gameNames.map(n => `:small_blue_diamond: ${n}`).join("\n");
//
//             message.reply(`Lista de jogos do sorteio \`${giveInfo.name}\`
// ${gamesList}`);
//
//         });
    }

    giveawayListParticipantsCommand(message, args) {
        return this.db.getOne('atual')
            .then(giveInfo => {
                if (!giveInfo) {
                    return message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                }

                return this.db.getAll('lista', {})
                    .then(participants => {
                        const ids = Object.keys(participants);

                        if (ids.length === 0) {
                            return message.reply(`:x: Não há nenhum participante no sorteio \`${giveInfo.name}\`.`);
                        }

                        // TODO: o resto
                    })
                ;
            })
            ;

//         let giveInfo;
//         const giveRef = ref.child(`atual`);
//
//         giveRef.once('value', snapshot => {
//             giveInfo = snapshot.val();
//
//             if (!giveInfo) {
//                 message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
//                 return;
//             }
//
//             ref.child(`lista`).once('value', sn => {
//                 const keys = Object.keys(sn.val() || {});
//
//                 if (keys.length === 0) {
//                     message.reply(`:x: Não há nenhum participante no sorteio \`${giveInfo.name}\`.`);
//                     return;
//                 }
//
//                 console.log(keys);
//
//                 let ticketsCounts = {};
//                 let minBound = 0, maxBound;
//
//                 for (let i = 0; i < keys.length; i++) {
//                     let userId = keys[i];
//                     let ticketCount = 100;
//
//                     if (!adminsIds.includes(userId)) {
//                         const mbr = message.guild.members.get(userId);
//                         mbr.roles.array().forEach(role => {
//                             if (leveledRoles.includes(role.id)) {
//                                 // a cada role que o usuario tiver ele ganha 5% a mais de chance de ganhar
//                                 ticketCount *= 1.05;
//                             }
//                         });
//                     }
//
//                     maxBound = parseInt(ticketCount);
//                     ticketsCounts[userId] = [ minBound, minBound + maxBound - 1, maxBound - 1 ];
//
//                     minBound += maxBound;
//                 }
//
//                 console.log('TICKETS', ticketsCounts);
//
//                 let tickets = [];
//                 for (let userId in ticketsCounts) {
//                     tickets.push([message.guild.members.get(userId), ticketsCounts[userId]]);
//                 }
//
//                 const ticketsList = tickets.map(t => {
//                     const m = t[0], tickets = t[1];
//                     const addon = giveInfo.creator === message.author.id ? ` *[tickets nº: ${tickets[0]}-${tickets[1]}]*` : ` *[tickets: ${tickets[2]}]*`;
//
//                     if (!m.nickname) {
//                         return `**${m.user.username}#${m.user.discriminator}**${addon}`;
//                     }
//                     return `**${m.nickname} (${m.user.username}#${m.user.discriminator})**${addon}`;
//                 }).map(n => `:small_blue_diamond: ${n}`).join("\n");
//
//                 message.reply(`Participantes do sorteio \`${giveInfo.name}\`
// ${ticketsList}`);
//
//             });
//
//         });

    }

    commands() {
        return {
            'giveaway': [this.giveawayCommand, { disallowDM: true }],
        }
    }
}

module.exports = Sorteio;