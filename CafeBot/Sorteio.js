
const utils = require('../utils');
const Discord = require("discord.js");
const Cafebase = require('./Cafebase');

const InteractivePrompt = require('./Util/InteractivePrompt');
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
                return this.giveawayListCommand(message, args);
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
                return this.giveawayListCommand(message, args);
            case 'cancel':
            case 'delete':
            case 'c':
                return this.giveawayCancelCommand(message, args);
            default:
                const commands = ['start/create', 'end', 'list', 'cancel/delete'].map(c => `\`${c}\``).join(', ');
                return message.reply(`:x: Comando inexistente.\nComandos disponíveis: ${commands} ou \`help\` para mais detalhes.`);
        }
    }

    /**
     * Cria um sorteio.
     * Só pode ser criado um sorteio por vez, e esse
     * sorteio será considerado o sorteio atual.
     * Se tentar cadastrar outro sorteio, você será impedido.
     *
     * @param message
     * @param args
     * @return {Promise<Object>}
     */
    giveawayCreateCommand(message, args) {
        // verifica se é um admin para criar um giveaway
        if (!hasPermission(message)) {
            throw new PermissionError(`Você não tem permissão de criar um sorteio.`);
        }

        const isRecover = args.includes('--recover');

        const prompt = new InteractivePrompt(message.channel, message.author, ':tickets: **Criando um prêmio para o giveaway** :new:', 60000)
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
                'Quantos prêmios terão nesse giveaway?',
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
                '`Prêmio #_gameIndex#`\nDigite o nome do prêmio.',
                'Digite o nome',
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
                '`Prêmio #_gameIndex#`\nDigite as instruções para resgate desse prêmio.\n' +
                    + 'Se for um jogo, digite o gift link dele.\n'
                    + 'Se for gift do Steam, digite a URL do usuário '
                    + 'da steam. Caso seja uma key, digite a key.',
                'Digite o link para resgate do prêmio',
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
                        // chegou no ultimo premio, pede pra confirmar
                        p.setNext('g-confirmation');
                    } else {
                        // vai pro proximo premio
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
                'Digite `yes` ou `y` para confirmar, `more` para adicionar mais um prêmio',
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

                        let toSave = [['atual', info]];
                        if (!isRecover) {
                            // se não for pra recuperar um sorteio perdido,
                            // limpa a lista de participantes pra começar do zero.
                            toSave.push(['lista', null]);
                        }

                        // salva o sorteio atual e limpa a lista de participantes
                        return this.db.saveAll(toSave)
                            .then(() => {
                                return message.reply(`:white_check_mark: Sorteio \`${info.name}\` `
                                    + (isRecover ? `recuperado.` : `criado.`));
                            })
                            ;
                    })
                ;
            })
        ;
    }

    /**
     * Participa do sorteio atual, caso haja.
     *
     * @param message
     * @param args
     * @return {Promise<Object>}
     */
    giveawayParticipateCommand(message, args) {
        const userId = message.author.id;

        return this.db.getOne('atual')
            .then(giveInfo => {
                if (!giveInfo) {
                    return message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                }

                if (!message.member.roles.cache.some(r => leveledRoles.includes(r.id))) {
                    const minimumLevel = message.guild.roles.cache.get(leveledRoles[0]);
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
    }

    /**
     * Finaliza o sorteio atual, sorteando e distribuindo os prêmios
     * entre os participantes, caso haja um sorteio.
     *
     * @param message
     * @param args
     * @return {Promise<Object>}
     */
    giveawayEndCommand(message, args) {
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

                        let winners = [], winnerMessagesDMs = [], luckyNumbers = [];
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
                                        console.log('GIVEAWAY shuffle again', luckyNumber, winners.includes(winner), count);
                                        return _shuffle(max, count);
                                    }

                                    let sendPromise;
                                    if (isDebug) {
                                        // se é só teste, não precisa enviar dm
                                        winnerMessagesDMs.push(null);
                                        sendPromise = Promise.resolve();
                                    } else {
                                        sendPromise = winner.user.createDM()
                                            .then(dm => {
                                                // depois tenta mandar uma msg
                                                return dm.send('.');
                                            })
                                            .then(testMessage => {
                                                // conseguiu abrir dm e mandar a mensagem, entao
                                                // vai conseguir mandar o premio
                                                winnerMessagesDMs.push(testMessage);
                                                return Promise.resolve(testMessage);
                                            })
                                        ;
                                    }

                                    // tenta abrir uma dm com o ganhador
                                    return sendPromise
                                        .catch((err) => {
                                            // por algum motivo, a dm não pôde ser aberta
                                            // com o usuário. isso acontece se ele tiver
                                            // com configurações de privacidade que impedem
                                            // que ele receba mensagens diretas de membros de
                                            // um servidor.
                                            // caso aconteça isso, eu não posso prejudicar os
                                            // outros ganhadores, portanto, eu faço o código
                                            // recuperar desse erro e marco esse ganhador
                                            // como pessoa q tem que retirar esse premio
                                            // "manualmente" com o criador do giveaway.
                                            winnerMessagesDMs.push(null);

                                            // não retornar nada recupera do erro aqui e
                                            // executa o proximo .then
                                            // visto em: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
                                        })
                                        .then(() => {
                                            // se entrou aqui, é pq foi recuperado do catch acima
                                            // e deu tudo certo

                                            // coloca nos ganhadores
                                            winners.push(winner);
                                            luckyNumbers.push(luckyNumber);

                                            // proximo numero
                                            return _shuffle(max, count - 1);
                                        })
                                    ;
                                })
                            ;
                        }

                        // começa a sortear cada numero, de acordo com o numero de premios disponíveis
                        return _shuffle(maxShuffle, giveInfo.games)
                            .then(() => {
                                let winnersText = '';

                                winners.forEach((winner, idx) => {
                                    // const username = winner.user.username + '#' + winner.user.discriminator;
                                    // const nick = winner.nickname ? winner.nickname + ` (${username})` : username;

                                    const wMessage = winnerMessagesDMs[idx];

                                    if (wMessage) {
                                        const prizeText = ''
                                            + `:trophy: **Sorteio \`${giveInfo.name}\`**\n\n`
                                            + `:tada: Você ganhou **${giveInfo.gameNames[idx]}**! :tada:\n`
                                            + `A forma de como resgatar seu prêmio está logo abaixo.\n`
                                            + `Só seguir as instruções da mensagem ou do link:\n\n`
                                            + giveInfo.gameLinks[idx]
                                            + `\n\nSe tiver dúvidas, só falar com um de nossos admins.`
                                        ;
                                        wMessage.edit(prizeText).catch(err => {
                                            // por algum motivo não pode editar a mensagem
                                            // pra poder dar pro usuário o premio.
                                            message.channel.send(`:x: Por algum motivo houve um erro ao enviar o prêmio para ${winner}. [Erro] ${err}`);
                                        });
                                    }

                                    winnersText += "\n"
                                        + `:small_blue_diamond: Prêmio `
                                        + '*' + giveInfo.gameNames[idx] + '*: '
                                        + `${winner}`
                                        + (!wMessage ? ' *(:x: Não foi possível enviar por DM)*' : '')
                                        + (isDebug ? ` *[ticket nº: ${luckyNumbers[idx]}]*` : '')
                                    ;
                                });

                                return message.channel.send(
                                    (isDebug ? ':exclamation: É SOMENTE UM TESTE :exclamation:' : '')
                                    + `:trophy: **Resultados do sorteio \`${giveInfo.name}\`**\nVencedores:${winnersText}`)
                                    .then(() => {
                                        if (!isDebug) {
                                            // apaga o sorteio
                                            return this.db.save('atual', null);
                                        }
                                    })
                                    ;
                            })
                        ;

                    })
                ;
            })
        ;
    }

    /**
     * Cancela o sorteio atual, caso haja.
     *
     * @param message
     * @param args
     * @return {Promise<Object>}
     */
    giveawayCancelCommand(message, args) {
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
    }

    /**
     * Lista os prêmios do sorteio atual, caso haja um sorteio.
     *
     * @param message
     * @param args
     * @return {Promise<Object>}
     */
    giveawayListCommand(message, args) {
        return this.db.getOne('atual')
            .then(giveInfo => {
                if (!giveInfo) {
                    return message.reply(`:thumbsdown: Nenhum giveaway no momento.`);
                }

                const gamesList = giveInfo.gameNames.map(n => `:small_blue_diamond: ${n}`).join("\n");
                return message.reply(`Lista de prêmios do sorteio \`${giveInfo.name}\`\n${gamesList}`);
            })
            ;
    }

    /**
     * Lista todos os participantes do sorteio atual, caso haja um sorteio.
     *
     * @param message
     * @param args
     * @return {Promise<Object>}
     */
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
    }

    commands() {
        return {
            'giveaway': [this.giveawayCommand, { disallowDM: true }],
            'giveaway-dm': this.giveawayDMCommand,
        }
    }
}

/**
 * Retorna um array todos os participantes com seus
 * devidos tickets distribuídos.
 *
 * @param {Sorteio} sorteio
 * @param {Discord.Guild} guild
 * @return {Promise<Array>} Um array onde cada elemento é um objeto, em que member = participante e tickets = os tickets
 */
function getParticipantsWithTickets(sorteio, guild) {
    return sorteio.db.getAll('lista', {})
        .then(participants => {
            let ids = Object.keys(participants);

            if (ids.length === 0) {
                return [];
            }

            return guild.members.fetch()
                .then(members => {
                    // garante que sempre vai ser os mesmos tickets
                    ids.sort();

                    // começa a distribuicao de tickets
                    let tickets = [];
                    let minBound = 0, maxBound = 0;

                    ids.forEach(id => {
                        const member = members.get(id);
                        if (member) {
                            let ticketCount = 100;

                            if (!ADMIN_IDS.includes(id)) {
                                member.roles.cache.forEach(role => {
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
