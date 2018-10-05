
const utils = require('../utils');
const Discord = require("discord.js");
const Cafebase = require('./Cafebase');

const InterativePrompt = require('./Util/InterativePrompt');
const randomNumber = require('./Util/RandomNumber');

const PermissionError = require('./Errors/PermissionError');

const ADMIN_IDS = require('../adminIds');

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
    get icon() { return ':tickets:' }

    giveawayCommand(message, args) {
        const arg = args.shift();
        switch (arg) {
            case 'start':
            case 'create':
            case 's':
                return this.giveawayCreateCommand(message, args);
            case 'end':
            case 'e':
                return this.giveawayEndCommand(message, args);
            case 'list':
            case 'l':
                return this.giveawayListGamesCommand(message, args);
            case 'cancel':
            case 'delete':
            case 'c':
                return this.giveawayCancelCommand(message, args);
            case 'who':
            case 'w':
                return this.giveawayListParticipantsCommand(message, args);
            case 'help':
                const adminCommands = hasPermission(message) ? ['start/create', 'end', 'cancel/delete'] : [];
                const commands = adminCommands.concat(['list', 'who']).map(c => `\`${c}\``).join(', ');
                return message.reply(`:x: Comando inexistente.\nComandos disponíveis: ${commands}`);
            default:
                return this.giveawayParticipateCommand(message, args);
        }
    }

    giveawayDMCommand(message, args) {
        const arg = args.shift();
        switch (arg) {
            case 'start':
            case 'create':
            case 's':
                return this.giveawayCreateCommand(message, args);
            case 'end':
            case 'e':
                return this.giveawayEndCommand(message, args);
            case 'list':
            case 'l':
                return this.giveawayListGamesCommand(message, args);
            case 'cancel':
            case 'delete':
            case 'c':
                return this.giveawayCancelCommand(message, args);
            default:
                const commands = ['start/create', 'end', 'list', 'cancel/delete'].map(c => `\`${c}\``).join(', ');
                return message.reply(`:x: Comando inexistente.\nComandos disponíveis: ${commands} ou \`help\` para mais detalhes.`);
        }
    }

    giveawayCreateCommand(message, args) {
        // verifica se é um admin para criar um giveaway
        if (!hasPermission(message)) {
            throw new PermissionError(`Você não tem permissão de criar um sorteio.`);
        }

        const prompt = new InterativePrompt(message.channel, message.author, ':tickets: **Criando um jogo para o giveaway** :new:', 30000)
            .addPrompt(
                'g-title',
                'Escolha um título para esse giveaway.',
                'Digite um título qualquer',
                response => {
                    return !response.startsWith(utils.prefix);
                },
                (choice, p) => {
                    p.setChoice('title', choice);
                    p.setNext('g-game-count')
                }
            )
            .addPrompt(
                'g-game-count',
                'Quantos jogos terão nesse giveaway?',
                'Digite a quantidade',
                response => {
                    const v = parseInt(response);
                    return v >= 1 && v < 100;
                },
                (choice, p) => {
                    p.setChoice('gamesCount', parseInt(choice));
                    p.setChoice('_gameIndex', 1);
                    p.setNext('g-game-title')
                }
            )
            .addPrompt(
                'g-game-title',
                '`Jogo #_gameIndex#`\nDigite o nome do jogo.',
                'Digite o nome completo do jogo',
                response => {
                    return !response.startsWith(utils.prefix);
                },
                (choice, p) => {
                    const arr = p.getChoice('gameNames') || [];
                    arr.push(choice);
                    p.setChoice('gameNames', arr);
                    p.setNext('g-game-link');
                }
            )
            .addPrompt(
                'g-game-link',
                '`Jogo #_gameIndex#`\nDigite o link para resgate do jogo.\n'
                    + 'Se for gift do Steam, digite a URL do usuário '
                    + 'da steam. Caso seja uma key, digite a key.',
                'Digite o link para resgate do jogo',
                response => {
                    return !response.startsWith(utils.prefix);
                },
                (choice, p) => {
                    const arr = p.getChoice('gameLinks') || [];
                    arr.push(choice);
                    p.setChoice('gameLinks', arr);

                    let index = p.getChoice('_gameIndex');
                    index++;
                    p.setChoice('_gameIndex', index);

                    // ver se termina ou começa de novo
                    if (index > p.getChoice('gamesCount')) {
                        // chegou no ultimo jogo, pede pra confirmar
                        p.setNext('g-confirmation');
                    } else {
                        // vai pro proximo jogo
                        p.setNext('g-game-title');
                    }
                }
            )
            .addPrompt(
                'g-confirmation',
                (choices) => {
                    let text = "Está tudo correto?";
                    for (let i = 0; i < choices.gamesCount; i++) {
                        text += `\n`
                            + `:small_orange_diamond: `
                            + choices.gameNames[i]
                        ;
                    }
                    return text;
                },
                'Digite `yes` ou `y` para confirmar, `more` para adicionar mais um jogo',
                response => {
                    return ['yes', 'y', 'more'].includes(response);
                },
                (choice, p) => {
                    if (choice === 'more') {
                        p.setChoice('gamesCount', p.getChoice('gamesCount') + 1);
                        p.setNext('g-game-title');
                    }

                    // deu tudo certo
                }
            )
        ;

        return this.db.getOne('atual')
            .then(giveInfo => {
                if (giveInfo) {
                    return message.reply(`:x: Já existe um sorteio em andamento.`);
                }

                return prompt.start('g-title')
                    .then(choices => {
                        const info = {
                            games: choices.gamesCount,
                            creator: message.author.id,
                            gameNames: choices.gameNames,
                            gameLinks: choices.gameLinks,
                            name: choices.title
                        };

                        return this.db.saveAll([['atual', info], ['lista', null]])
                            .then(() => {
                                return message.reply(`:white_check_mark: Sorteio \`${info.name}\` criado.`);
                            })
                            ;
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
        if (!hasPermission(message)) {
            throw new PermissionError(`Você não tem permissão de encerrar um sorteio.`);
        }

        const isDebug = args.includes('--debug') && hasPermission(message);

        return this.db.getOne('atual')
            .then(giveInfo => {
                if (!giveInfo) {
                    return message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                }

                if (giveInfo.creator !== message.author.id) {
                    throw new PermissionError(`Somente o criador do giveaway pode encerrá-lo.`);
                }

                return getParticipantsWithTickets(this, message.guild)
                    .then(tickets => {
                        if (tickets.length === 0) {
                            return message.reply(`:x: Não há nenhum participante no sorteio \`${giveInfo.name}\`.`);
                        }

                        if (tickets.length < giveInfo.games) {
                            return message.reply(`:x: Não há participantes suficientes pro sorteio \`${giveInfo.name}\`. Necessitam pelo menos **${giveInfo.games}** (tem **${tickets.length}**).`);
                        }

                        let winners = [], luckyNumbers = [];
                        const maxShuffle = tickets.max;

                        function _shuffle(max, count) {
                            return randomNumber(0, max)
                                .then(luckyNumber => {
                                    if (count === 0) {
                                        // terminou de sortear todos
                                        return Promise.resolve();
                                    }

                                    let winner = null;

                                    // acha o ganhador
                                    tickets.forEach(t => {
                                        if (luckyNumber >= t.tickets[0] && luckyNumber < t.tickets[1]) {
                                            // sorteado
                                            winner = t.member;
                                        }
                                    });

                                    if (!winner || winners.includes(winner)) {
                                        // se não teve ganhador, ou o ganhador já ganhou
                                        // tenta sortear de novo
                                        console.log('again', luckyNumber, winners.includes(winner), count);
                                        return _shuffle(max, count);
                                    }

                                    // coloca nos ganhadores
                                    winners.push(winner);
                                    luckyNumbers.push(luckyNumber);

                                    // proximo numero
                                    return _shuffle(max, count - 1);
                                })
                            ;
                        }

                        return _shuffle(maxShuffle, giveInfo.games)
                            .then(() => {
                                let winnersText = '';

                                winners.forEach((winner, idx) => {
                                    const username = winner.user.username + '#' + winner.user.discriminator;
                                    const nick = winner.nickname ? winner.nickname + ` (${username})` : username;

                                    winnersText += "\n"
                                        + `:small_blue_diamond: Prêmio `
                                        + '*' + giveInfo.gameNames[idx] + '*: '
                                        + `${winner}`
                                        + (isDebug ? ` *[ticket nº: ${luckyNumbers[idx]}]*` : '')
                                    ;
                                });

                                return message.channel.send(`:trophy: **Resultados do sorteio \`${giveInfo.name}\`**\nVencedores:${winnersText}`);
                            })
                        ;

                    })
                ;

                // return this.db.save('atual', null)
                //     .then(() => {
                //         return message.reply(`:white_check_mark: Sorteio \`${giveInfo.name}\` cancelado.`);
                //     })
                //     ;
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
        if (!hasPermission(message)) {
            throw new PermissionError(`Você não tem permissão de cancelar um sorteio.`);
        }

        return this.db.getOne('atual')
            .then(giveInfo => {
                if (!giveInfo) {
                    return message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                }

                if (giveInfo.creator !== message.author.id) {
                    throw new PermissionError(`Somente o criador do giveaway pode cancelá-lo.`);
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

                const gamesList = giveInfo.gameNames.map(n => `:small_blue_diamond: ${n}`).join("\n");
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
        const isDebug = args.includes('--debug') && hasPermission(message);
        return this.db.getOne('atual')
            .then(giveInfo => {
                if (!giveInfo) {
                    return message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                }

                return getParticipantsWithTickets(this, message.guild)
                    .then(tickets => {
                        if (tickets.length === 0) {
                            return message.reply(`:x: Não há nenhum participante no sorteio \`${giveInfo.name}\`.`);
                        }

                        let participantsText = '';

                        tickets.forEach(t => {
                            const username = t.member.user.username + '#' + t.member.user.discriminator;
                            const nick = t.member.nickname ? t.member.nickname + ` (${username})` : username;

                            participantsText += "\n"
                                + `:small_blue_diamond: `
                                + nick
                                + (isDebug ? ` *[tickets nº: ${t.tickets[0]}-${t.tickets[1]}]* *[tickets: ${t.tickets[2]}]*` : '')
                            ;
                        });

                        return message.reply(`Participantes do sorteio \`${giveInfo.name}\`:${participantsText}`);
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
            'giveaway-dm': this.giveawayDMCommand,
        }
    }
}

function getParticipantsWithTickets(sorteio, guild) {
    return sorteio.db.getAll('lista', {})
        .then(participants => {
            let ids = Object.keys(participants);

            if (ids.length === 0) {
                return [];
            }

            return guild.fetchMembers()
                .then(guild => {
                    // garante que sempre vai ser os mesmos tickets
                    ids.sort();

                    // começa a distribuicao de tickets
                    let tickets = [];
                    let minBound = 0, maxBound = 0;

                    ids.forEach(id => {
                        const member = guild.members.get(id);
                        if (member) {
                            let ticketCount = 100;

                            if (!ADMIN_IDS.includes(id)) {
                                member.roles.forEach(role => {
                                    if (leveledRoles.includes(role.id)) {
                                        // a cada role que o usuario tiver ele ganha 5% a mais de chance de ganhar
                                        ticketCount *= 1.05;
                                    }
                                });
                            }

                            maxBound = parseInt(ticketCount);
                            tickets.push({
                                member: member,
                                tickets: [minBound, minBound + maxBound - 1, maxBound - 1]
                            });

                            minBound += maxBound;
                        }
                    });

                    tickets.min = 0;
                    tickets.max = minBound - 1;

                    console.log('TICKETS', tickets);
                    return tickets;
                })
            ;
        })
        ;
}

function hasPermission(message) {
    if (message.channel instanceof Discord.DMChannel) {
        if (ADMIN_IDS.includes(message.author.id)) {
            return true;
        }
        return false;
    }
    return message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS);
}

module.exports = Sorteio;