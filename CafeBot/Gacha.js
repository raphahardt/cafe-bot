
const fbAdmin = require("firebase-admin");
const fbServiceAccount = require("../misc/cafebot-2018-firebase-adminsdk-j17ic-a11e9f3222.json");
const utils = require('../utils');
const ADMIN_IDS = require('../adminIds');
const Discord = require("discord.js");
const Jimp = require('jimp');
const GIFEncoder = require('gifencoder');

const fbApp = fbAdmin.initializeApp({
    credential: fbAdmin.credential.cert(fbServiceAccount),
    databaseURL: "https://cafebot-2018.firebaseio.com"
}, 'gacha');

const db = fbApp.database();
const ref = db.ref('gacha');

const GACHA_TYPES = {
    'role': 1,
    'fake': 1
};

const GACHA_RARITIES = [
    { letter: 'C', emojiLetter: ':regional_indicator_c:', chance: 1.00, exchange: 5 },
    { letter: 'B', emojiLetter: ':regional_indicator_b:', chance: 0.30, exchange: 10 },
    { letter: 'A', emojiLetter: ':regional_indicator_a:', chance: 0.05, exchange: 25 },
    { letter: 'S', emojiLetter: ':regional_indicator_s:', chance: 0.01, exchange: 50 },
];

const GACHA_PULL_COST = 50;
const GACHA_MAX_PULLS = 12;
const GACHA_INITIAL_TOKENS = 200;

// 7 dias
const GACHA_MAX_TIMESTAMP_IN_SECS = 7 * 24 * 60 * 60000;

const GACHA_EXTRA_TOKENS_CHANNEL = '346798009050333184';
const GACHA_EXTRA_TOKENS_PRIZE = 100;
const GACHA_EXTRA_TOKENS_REACT_GIVEN = 10;
const GACHA_EXTRA_TOKENS_REACT_RECEIVED = 6;
const GACHA_EXTRA_TOKENS_MAX_REACTS = 5;

const GACHA_VALID_CHANNELS = [
    '213797930937745409', // mesa
    '430684220306882561', // jogos
    '346798009050333184', // desenhos
    '414209945576275968', // selfie
];

class Gacha {
    constructor () {}

    static get name() { return 'gacha' }

    static gachaCommand(message, args) {
        const arg = args.shift();
        switch (arg) {
            case 'create':
            case 'c':
                return Gacha.gachaCreateCommand(message, args);
            case 'delete':
            case 'd':
                return Gacha.gachaDeleteCommand(message, args);
            case 'info':
            case 'stats':
            case 'i':
                return Gacha.gachaInfoCommand(message, args);
            case 'list':
            case 'l':
                return Gacha.gachaListCommand(message, args);
            case 'equip':
                return Gacha.gachaEquipCommand(message, args);
            case 'exchange':
                return Gacha.gachaExchangeCommand(message, args);
            case 'pull':
            case 'roll':
            case 'p':
                return Gacha.gachaPullCommand(message, args);
            case 'help':
                message.reply("Ainda não fiz :3");
                break;
            default:
                message.reply(":x: Comando inexistente.\nComandos disponíveis: ");
        }
    }

    /**
     * Cria um item de gacha.
     * Somente admins podem.
     *
     * @param message
     * @param args
     */
    static gachaCreateCommand(message, args) {
        try {
            if (!hasPermission(message)) {
                message.reply(`:x: *Você não tem permissão de usar esse comando.*`);
                return;
            }
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            /*const type = args.shift();

            switch (type) {
                case 'role':
            }*/

            const rarity = rarityLetterToNumber(args.shift());
            const color = args.shift();
            const nome = args.join(' ');

            if (rarity === false) {
                const lettersText = GACHA_RARITIES.map(r => '`' + r.letter + '`').join(', ');
                message.reply(`:x: Raridade incorreta. Deve ser uma das letras: ${lettersText}`);
                return;
            }

            createRole(guild, member, color, rarity, nome).then(item => {
                return message.reply(`:white_check_mark: Role ${formatItem(guild, item)} criada com sucesso.`);
            }).catch(error => {
                console.error(error);
                message.reply(`:x: ${error}`);
            });

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /**
     * Excluí um item de gacha criado.
     * Somente admins podem.
     *
     * @param message
     * @param args
     */
    static gachaDeleteCommand(message, args) {
        try {
            if (!hasPermission(message)) {
                message.reply(`:x: *Você não tem permissão de usar esse comando.*`);
                return;
            }
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            const color = args.shift();

            findByColor(color).then(item => {
                deleteRole(guild, member, item).then(() => {
                    return message.reply(`:white_check_mark: Role excluída com sucesso.`);
                }).catch(error => {
                    console.error(error);
                    message.reply(`:x: ${error}`);
                });
            }).catch(error => {
                console.error(error);
                message.reply(`:x: ${error}`);
            });

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /**
     * Lista todos os itens de gacha disponíveis para ganhar.
     *
     * @param message
     * @param args
     */
    static gachaListCommand(message, args) {
        try {
            const isDebug = args.includes('--debug') && hasPermission(message);
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            ref.child('roles').once('value', snapshot => {
                const savedRoles = snapshot.val();
                let foundRoles = '';

                for (let id in savedRoles) {
                    if (!savedRoles.hasOwnProperty(id)) continue;
                    const savedRole = savedRoles[id];

                    foundRoles += `\n:small_blue_diamond: `
                        + (isDebug ? `<@${savedRole.author}> ` : '')
                        + formatItem(guild, savedRole);
                }

                if (!foundRoles) {
                    message.reply(`:x: Nenhum item de gacha registrado. Aguarde os admins criarem novos itens.`);
                    return;
                }

                utils.sendLongMessage(message.channel, `:gift: Itens disponíveis:${foundRoles}`);
            });

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /**
     * Info do usuário.
     *
     * @param message
     * @param args
     */
    static gachaInfoCommand(message, args) {
        try {
            const isDebug = args.includes('--debug') && hasPermission(message);
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            ref.child('info/' + member.id).once('value', snapshot => {
                const info = snapshot.val() || {};

                info.roles = info.roles || {};
                info.tokens = info.tokens || GACHA_INITIAL_TOKENS;

                ref.child('roles').once('value', snapshot => {
                    const savedRoles = snapshot.val();
                    let foundRoles = '';
                    let userRoleIndex = 1;

                    for (let id in savedRoles) {
                        if (!savedRoles.hasOwnProperty(id)) continue;
                        const savedRole = savedRoles[id];
                        if (info.roles[savedRole.id]) {
                            foundRoles += `\n:small_blue_diamond: `
                                + `\`[${userRoleIndex}]\` `
                                + `${info.roles[savedRole.id]}x `
                                + formatItem(guild, savedRole, false, info.equip === savedRole.id)
                                + (info.equip === savedRole.id ? ' *[Equipado]*' : '');

                            userRoleIndex++;
                        }
                    }

                    if (!foundRoles) {
                        message.reply(`:x: Você não possui nenhum item.`);
                        return;
                    }

                    utils.sendLongMessage(message.channel, `${member},\nSeus tokens: **${info.tokens}**\n\nSeus itens:${foundRoles}\n\nPara equipar um item, use \`+gacha equip (número do item)\`.`);
                });

            });


        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }

    }

    /**
     * Info do usuário.
     *
     * @param message
     * @param args
     */
    static gachaEquipCommand(message, args) {
        try {
            const isDebug = args.includes('--debug') && hasPermission(message);
            const equipIndex = parseInt(args.shift());
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            ref.child('info/' + member.id).once('value', snapshot => {
                const info = snapshot.val() || {};

                info.roles = info.roles || {};

                let oldEquip, newEquip;

                ref.child('roles').once('value', snapshot => {
                    const savedRoles = snapshot.val();
                    let foundRoles = 0;
                    let userRoleIndex = 1;

                    for (let id in savedRoles) {
                        if (!savedRoles.hasOwnProperty(id)) continue;
                        const savedRole = savedRoles[id];

                        // old equip
                        if (info.equip === savedRole.id) {
                            oldEquip = savedRole;
                        }

                        // new equip
                        if (info.roles[savedRole.id]) {
                            if (userRoleIndex === equipIndex) {
                                newEquip = savedRole;
                            }

                            foundRoles++;
                            userRoleIndex++;
                        }
                    }

                    if (!newEquip) {
                        message.reply(`:x: Item \`${equipIndex}\` não existe. Digite um número de 1 a ${foundRoles}.`);
                        return;
                    }

                    if (!foundRoles) {
                        message.reply(`:x: Você não possui nenhum item.`);
                        return;
                    }

                    // muda a role do usuario
                    let equipPromise;
                    const isEquip = (!oldEquip || (newEquip.id !== oldEquip.id));
                    if (!isEquip) {
                        // desequipar
                        equipPromise = member.removeRole(newEquip.role);
                    } else {
                        // equipar e tirar a antiga, se tiver
                        equipPromise = member
                            .addRole(newEquip.role)
                            .then(() => {
                                if (oldEquip) {
                                    return member.removeRole(oldEquip.role);
                                }
                                return Promise.resolve();
                            });
                    }
                    equipPromise
                        .then(() => {
                            // muda info
                            info.equip = isEquip ? newEquip.id : null;

                            ref.child('info/' + member.id).set(info, err => {
                                if (err) {
                                    console.error(err);
                                    message.reply(`:x: ${err}`);
                                    return;
                                }

                                message.reply(`:white_check_mark: Item ${formatItem(guild, newEquip)} ` + (isEquip ? 'equipado' : 'desequipado') + '.');
                            });
                        })
                        .catch(error => {
                            console.error(error);
                            message.reply(`:x: ${error}`);
                        })
                    ;

                });

            });


        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }

    }

    /**
     * Puxa um gacha. Pode usar #x, onde # é um numero maior que 1, que
     * puxa de uma vez varios gachas.
     *
     * @param message
     * @param args
     */
    static gachaPullCommand(message, args) {
        try {
            const isDebug = args.includes('--debug') && hasPermission(message);
            let pullTimes = parseInt(args.shift()) || 1;
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            // limita
            pullTimes = Math.min(GACHA_MAX_PULLS, Math.max(1, pullTimes));

            const pullCostTotal = pullTimes * GACHA_PULL_COST;

            ref.child('roles').once('value', snapshot => {
                const savedRoles = snapshot.val();

                if (!savedRoles) {
                    message.reply(`:x: Nenhum item de gacha registrado. Aguarde os admins criarem novos itens.`);
                    return;
                }

                ref.child('info/' + member.id).once('value', snapshot => {
                    const info = snapshot.val() || {};

                    info.tokens = info.tokens || GACHA_INITIAL_TOKENS;
                    info.roles = info.roles || {};

                    if (info.tokens < pullCostTotal && !isDebug) {
                        message.reply(`:x: Você não tem token suficiente. Seus tokens: **${info.tokens}**. Você precisa: **${pullCostTotal}**.`);
                        return;
                    }

                    let itemsWon = [];
                    let news = [];

                    // 1x pull do gacha
                    for (let t = 0; t < pullTimes; t++) {
                        const maxShuffle = 10000;
                        const luckyNumber = Math.random() * maxShuffle;

                        // encontra qual tipo de item você vai ganhar primeiro
                        let rarityWon;
                        for (let r = GACHA_RARITIES.length - 1; r >= 0; r--) {
                            const rarityFactor = maxShuffle * GACHA_RARITIES[r].chance;

                            if (luckyNumber <= rarityFactor) {
                                rarityWon = r;
                                break;
                            }
                        }

                        console.log('RARITY WON', rarityWon);

                        // agora, entre os itens, encontra qual deles vc vai ganhar, baseado
                        // na raridade que você tirou
                        let possibleRoles = [];
                        for (let id in savedRoles) {
                            if (!savedRoles.hasOwnProperty(id)) continue;
                            const savedRole = savedRoles[id];

                            if (savedRole.rarity === rarityWon) {
                                possibleRoles.push(savedRole);
                            }
                        }

                        console.log('POSSIBLE ITEMS', possibleRoles);

                        // embaralha itens
                        possibleRoles = utils.shuffle(possibleRoles);

                        // ...e pego aleatoriamente um aleatoriamente
                        let idx = parseInt((Math.random() * (possibleRoles.length * 2000)) / 2000);
                        idx = Math.min(possibleRoles.length - 1, idx);
                        const item = possibleRoles[idx];

                        // coloca no hash de itens ganhos
                        itemsWon.push(item);

                        if (!isDebug) {
                            info.tokens -= GACHA_PULL_COST;
                        }
                    }
                    console.log('WON', itemsWon);

                    // adiciona os itens ganhos no seu inventario
                    for (let i = 0; i < itemsWon.length; i++) {
                        const item = itemsWon[i];
                        info.roles[item.id] = info.roles[item.id] || 0;
                        news.push(info.roles[item.id] === 0);
                        info.roles[item.id]++;
                    }

                    // salva e mostra os ganhos do gacha
                    ref.child('info/' + member.id).set(info, err => {
                        if (err) {
                            console.error(err);
                            message.reply(`:x: ${err}`);
                            return;
                        }

                        function _open(msg, countOpened) {
                            const min = itemsWon.length - countOpened;

                            let wonText = '';

                            for (let i = 0; i < itemsWon.length; i++) {
                                const item = itemsWon[i];

                                if (i >= min) {
                                    wonText += `\n`
                                        + `\`[${i+1}]\` `
                                        + `:gift:`;
                                } else {
                                    wonText += `\n`
                                        + `\`[${i+1}]\` `
                                        + formatItem(guild, item, news[i]);
                                }
                            }

                            msg.edit(`${member},\n:slot_machine: Resultado do seu pull:\n${wonText}`).then(() => {
                                if (countOpened > 0) {
                                    message.client.setTimeout(() => {
                                        _open(msg, countOpened - 1);
                                    }, 1500);
                                }
                            }).catch(err => {
                                // se deu algum erro, tentar revelar tudo de uma vez
                                console.error(err);
                                _open(msg, 0);
                            });
                        }

                        message.reply(`\n:slot_machine: Resultado do seu pull:
\n:game_die: Carregando resultados :game_die:`).then(msg => {
                            _open(msg, itemsWon.length);
                        });

                    });

                });

            });

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }

    }

    /**
     * Troca itens repetidos por tokens.
     *
     * @param message
     * @param args
     */
    static gachaExchangeCommand(message, args) {
        try {
            const isDebug = args.includes('--debug') && hasPermission(message);
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            ref.child('info/' + member.id).once('value', snapshot => {
                const info = snapshot.val() || {};

                let exchanges = {};
                for (let r = GACHA_RARITIES.length - 1; r >= 0; r--) {
                    exchanges[r] = 0;
                }

                info.roles = info.roles || {};
                info.tokens = info.tokens || GACHA_INITIAL_TOKENS;

                ref.child('roles').once('value', snapshot => {
                    const items = snapshot.val();
                    let foundItemsCount = 0;
                    // let itemIndex = 1;

                    for (let id in items) {
                        if (!items.hasOwnProperty(id)) continue;
                        const item = items[id];
                        if (info.roles[item.id] > 1) {

                            // pega só os itens repetidos e deixa apenas um
                            const itemCountToExchange = info.roles[item.id] - 1;
                            info.roles[item.id] = 1;

                            exchanges[item.rarity] += itemCountToExchange;
                            foundItemsCount++;

                            // foundItems += `\n:small_blue_diamond: `
                            //     + `\`[${itemIndex}]\` `
                            //     + `${info.roles[item.id]}x `
                            //     + formatItem(guild, item, false, info.equip === item.id)
                            //     + (info.equip === item.id ? ' *[Equipado]*' : '');
                            //
                            // itemIndex++;
                        }
                    }

                    if (!foundItemsCount) {
                        message.reply(`:x: Você não possui nenhum item repetido.`);
                        return;
                    }

                    let text = `\n:arrows_counterclockwise: Seu exchange:\n`;
                    let sumTokensExchange = 0;

                    for (let r = GACHA_RARITIES.length - 1; r >= 0; r--) {
                        const itemTokenExchange = GACHA_RARITIES[r].exchange * exchanges[r];

                        text += `\n  `
                            + GACHA_RARITIES[r].emojiLetter
                            + ` x ${exchanges[r]} = `
                            + `**${itemTokenExchange}**`
                        ;

                        sumTokensExchange += itemTokenExchange;
                    }

                    text += `\n   *Total* = **${sumTokensExchange}**`;

                    // soma os tokens novos
                    info.tokens += sumTokensExchange;

                    text += `\n\nSeu novo saldo de tokens: **${info.tokens}**`;

                    // salva e mostra os ganhos do gacha
                    ref.child('info/' + member.id).set(info, err => {
                        if (err) {
                            console.error(err);
                            message.reply(`:x: ${err}`);
                            return;
                        }

                        message.reply(text);
                    });

                });

            });


        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }

    }


    /**
     * Timer que roda a cada 1 minuto automaticamente.
     *
     * @param client
     * @param seconds
     * @param minutes
     * @param hours
     * @param day
     * @param month
     * @param dayWeek
     * @param year
     * @param date
     */
    static gachaTimer(client, seconds, minutes, hours, day, month, dayWeek, year, date) {
        try {
            const guild = client.guilds.get('213797930937745409');

            // a cada 15 minutos
            if (minutes % 30 === 0) {

                guild.fetchMembers()
                    .then(() => {
                        let tokenSums = {};

                        guild.members.forEach(member => {
                            /*for (let c = 0; c < GACHA_VALID_CHANNELS.length; c++) {
                                const channel = guild.channels.get(GACHA_VALID_CHANNELS[c]);
                            }*/
                            const lastMessage = member.lastMessage;

                            console.log('MEMBER', member.id, (lastMessage || {}).createdTimestamp);

                            if (lastMessage) {
                                const diff = date.getTime() - lastMessage.createdTimestamp;
                                const min = GACHA_MAX_TIMESTAMP_IN_SECS, max = 0;

                                // numero pelo qual, quando multiplicado, quanto mais perto do minimo, mais "zero" ele fica,
                                // e quanto mais perto do maximo, mais "um" ele fica
                                const penaltyRatio = Math.min(1, Math.max(0, (diff - min) / (max - min)));

                                let tokensToEarn = parseInt(Math.random() * 20) + 10;
                                tokensToEarn *= penaltyRatio;

                                // coloca nos tokens pra ganhar
                                tokenSums[member.id] = parseInt(tokensToEarn);

                                // salva
                                // ref.child('info/' + member.id).once('value', snapshot => {
                                //     const info = snapshot.val() || {};
                                //
                                //     info.tokens = info.tokens || GACHA_INITIAL_TOKENS;
                                //     info.tokens += tokensToEarn;
                                //
                                //     ref.child('info/' + member.id).set(info, err => {
                                //         if (err) {
                                //             console.error(err);
                                //             return;
                                //         }
                                //
                                //         // ganhou
                                //     });
                                // });
                            }
                        });

                        console.log('TOKEN SUMS', tokenSums);

                        // salva
                        ref.child('info').once('value', snapshot => {
                            const infos = snapshot.val() || {};

                            for (let id in tokenSums) {
                                infos[id] = infos[id] || {};
                                infos[id].tokens = infos[id].tokens || GACHA_INITIAL_TOKENS;
                                infos[id].tokens += tokenSums[id];
                            }

                            ref.child('info').set(infos, err => {
                                if (err) {
                                    console.error(err);
                                    return;
                                }

                                // salvo
                            });
                        });
                    });

            }
        } catch (error) {
            console.error(error);
        }
    }

    static onReactionAdd(messageReaction, user) {
        let reactCount = messageReaction.count;
        messageReaction.fetchUsers()
            .then(users => {
                if (users && !users.some(u => adminsIds.includes(u.id))) {
                    // ignora quem não for admin
                    return;
                }

                if (reactCount > 0 && messageReaction.emoji.name === '🔞') {
                    // marcar essa mensagem como nsfw
                    return messageReaction.message.delete();
                }
            })
            .then(msg => {
                if (msg) {
                    return createNsfwAlert(msg, true);
                }
            })
            .catch(console.error);
    }

    static onGuildMemberUpdate(oldMember, newMember) {

    }

    static commands() {
        return {
            'gacha': Gacha.gachaCommand
        }
    }

    static timers() {
        return {
            'gacha': Gacha.gachaTimer
        }
    }

    static events() {
        return {
            //'messageReactionAdd': Gacha.onReactionAdd
            //'guildMemberUpdate': Gacha.onGuildMemberUpdate
        }
    }
}

function createRole(guild, user, color, rarity, name) {
    return new Promise((resolve, reject) => {
        const colorNumber = Jimp.cssColorToHex(color);

        // procura pra ver se a cor já não existe
        findByColor(color).then((found) => {
            reject(`A role ${formatItem(guild, found)} já existe.`);
        }).catch(() => {
            // não encontrou, entao pode criar

            /*let foundRole;
            guild.roles.forEach(role => {
                console.log('color', role.color, colorNumber, parseInt(colorNumber / 0x100));
                if (role.color === colorNumber) {
                    foundRole = role;
                }
            });

            if (foundRole) {
                reject(`A cor ${color} já existe.`);
                return;
            }*/

            guild.createRole({
                name: name,
                color: color,
                //permissions: 0, // deixar comentado por enquanto
                hoist: false, // role não vai ter destaque nos online
                position: guild.roles.size - 13, // depois da role café com pão origins
                mentionable: false
            }, 'Criado para gacha por @' + user.username).then(role => {

                const encoder = new GIFEncoder(32, 32);
                encoder.start();
                encoder.repeat = 0; // 0 = loop, -1 = sem loop
                encoder.setDelay(50);
                encoder.setQuality(10); // 10 é default

                const emojiName = emojifyName('gacha' + role.id);

                new Promise((re, rj) => {
                    // cria o emoji pra cor da role
                    new Jimp(32, 32, colorNumber, (err, image) => {
                        if (err) {
                            rj(err);
                            return;
                        }
                        // adiciona dois frames dessa cor
                        encoder.addFrame(image.bitmap.data);
                        encoder.addFrame(image.bitmap.data);

                        encoder.finish();

                        const gifBuffer = encoder.out.getData();
                        const base64String = 'data:image/gif;base64,' + gifBuffer.toString('base64');
                        guild.createEmoji(base64String, emojiName).then(emoji => {
                            // salva tudo no db
                            const roleObj = {
                                role: role.id,
                                emoji: emoji.id,
                                author: user.id,
                                rarity: rarity,
                                color: color,
                                colorDecimal: colorNumber,
                                name: name
                            };

                            let savedRole = ref.child('roles').push();
                            roleObj.id = savedRole.key;

                            savedRole.set(roleObj, err => {
                                if (err) {
                                    // deu erro no banco, deleta o emoji pra reverter alterações
                                    guild.deleteEmoji(emoji, 'Erro ao salvar, revertendo');
                                    rj(err);
                                    return;
                                }
                                re(roleObj);
                            });
                        }).catch(rj);
                    });

                }).then((item) => {
                    // sucesso
                    resolve(item);
                }).catch(err => {
                    // se deu erro em algum momento na criacao da imagem/emoji,
                    // deleta a role pra reverter alterações
                    role.delete('Erro na criação do emoji, revertendo');
                    reject(err);
                });

            }).catch(reject);

        });
    });
}

function findByColor(color) {
    return new Promise((resolve, reject) => {
        ref.child('roles').once('value', snapshot => {
            const savedRoles = snapshot.val();

            for (let key in savedRoles) {
                if (!savedRoles.hasOwnProperty(key)) continue;

                const savedRole = savedRoles[key];
                if (savedRole.color === color) {
                    resolve(savedRole);
                    return;
                }
            }

            // não achou, rejeita
            reject(`Role não encontrada.`);
        });
    });
}

function deleteRole(guild, user, savedRole) {
    return new Promise((resolve, reject) => {
        guild.deleteEmoji(savedRole.emoji, `Excluído por comando gacha por @${user.username}`)
            .then(() => {
                // deletou emoji
                const role = guild.roles.get(savedRole.role);
                role.delete(`Excluído por comando gacha por @${user.username}`)
                    .then(() => {
                        // deletou role
                        ref.child('roles/' + savedRole.id).set(null, err => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            // deletado com sucesso
                            resolve();
                        });
                    }, reject);
            }, reject);
    });
}

function emojifyName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function formatItem(guild, item, isNew) {
    const emoji = guild.emojis.get(item.emoji);
    return `${emoji}${GACHA_RARITIES[item.rarity].emojiLetter} **${item.name}**`
        + (isNew ? ` :sparkles:` : '');
}

function rarityLetterToNumber(letter) {
    for (let i = 0; i < GACHA_RARITIES.length; i++) {
        if (GACHA_RARITIES[i].letter === letter.toUpperCase()) {
            return i;
        }
    }
    return false;
}

function formatFutureDate(now, future) {
    const diff = parseInt((future instanceof Date ? future.getTime() : future) / 1000)
        - parseInt((now instanceof Date ? now.getTime() : now) / 1000);

    if (diff < 0) {
        return 'um momento';
    }

    return formatTime(diff);
}

function formatTime(seconds) {
    if (seconds > 3600) {
        if (seconds > 2592000) {
            return parseInt(seconds / 2592000) + ' mes(es)';
        }
        if (seconds > 86400) {
            return parseInt(seconds / 86400) + ' dia(s)';
        }
        const minutes = parseInt((seconds % 3600) / 60);
        const minutesText = minutes > 0 ? ` e ${minutes} minuto(s)` : '';
        return parseInt(seconds / 3600) + ' hora(s)' + minutesText;
    }

    if (seconds > 60) {
        return parseInt(seconds / 60) + ' minuto(s)';
    }

    return parseInt(seconds) + ' segundo(s)';
}

function hasPermission(message) {
    if (message.channel instanceof Discord.DMChannel) {
        if (ADMIN_IDS.includes(message.author.id)) {
            return true;
        }
        return false;
    }
    return message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_ROLES);
}

function getCafeComPaoGuild(message) {
    const guild = message.guild || message.client.guilds.get('213797930937745409');
    if (!guild) {
        throw new Error("Não foi possível encontrar o Café com Pão. Algo deu muito errado...");
    }
    return guild;
}

function getCafeComPaoMember(guild, message) {
    const member = guild.member(message.author);
    if (!member) {
        throw new Error("Você não é um membro do Café com Pão.");
    }
    return member;
}

module.exports = Gacha;