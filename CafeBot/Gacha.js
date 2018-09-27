
const utils = require('../utils');
const ADMIN_IDS = require('../adminIds');
const Discord = require("discord.js");
const Jimp = require('jimp');
const GIFEncoder = require('gifencoder');

const Cafebase = require('./Cafebase');
const db = new Cafebase('gacha');

const GACHA_ITEM_TYPES = [
    { type: 'role', name: 'Role (cor)' },
    { type: 'icon', name: 'Ícone no nickname' },
    { type: 'troll', name: 'Troll (item sem valor)' },
];

const GACHA_RARITIES = [
    { letter: 'C', emojiLetter: ':regional_indicator_c:', chance: 1.000, exchange: 5 },
    { letter: 'B', emojiLetter: ':regional_indicator_b:', chance: 0.250, exchange: 10 },
    { letter: 'A', emojiLetter: ':regional_indicator_a:', chance: 0.040, exchange: 25 },
    { letter: 'S', emojiLetter: ':regional_indicator_s:', chance: 0.006, exchange: 50 },
];

const GACHA_PULL_COST = 100;
const GACHA_MAX_PULLS = 10;
const GACHA_INITIAL_TOKENS = 200;
const GACHA_EXTRA_CHANCE_MULTIPLIER = 1;

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

            const channel = message.channel;
            let oldMsg = null;

            let typesText = '';
            for (let t = 0; t < GACHA_ITEM_TYPES.length; t++) {
                typesText += `\n`
                    + `:small_orange_diamond: `
                    + `\`[${t + 1}]\` `
                    + GACHA_ITEM_TYPES[t].name
                ;
            }

            let raritiesText = '';
            for (let r = 0; r < GACHA_RARITIES.length; r++) {
                raritiesText += `\n`
                    + `:small_orange_diamond: `
                    + `\`[${r + 1}]\` `
                    + GACHA_RARITIES[r].emojiLetter
                ;
            }

            let itemSelected = {};

            // type msg
            channel.send(`:game_die: **Criando um novo item** :new:\n\nEscolha o tipo de item a ser criado:${typesText}\n\nDigite o número da opção ou \`cancel\` para cancelar.`)
                .then(msg => {
                    // type
                    oldMsg = msg;
                    return channel.awaitMessages(m => {
                        if (m.content === 'cancel') {
                            return true;
                        }
                        const v = parseInt(m.content);
                        return v >= 1 && v <= GACHA_ITEM_TYPES.length;
                    }, { max: 1, time: 30000, errors: ['time'] })
                })
                .then(collected => {
                    // escolhendo type
                    if (oldMsg) {
                        oldMsg.delete();
                        oldMsg = null;
                    }
                    const response = collected.first().content;

                    if (response === 'cancel') {
                        return Promise.reject(collected);
                    }

                    itemSelected.type = parseInt(response) - 1;

                    // rarity msg
                    return channel.send(`:game_die: **Criando um novo item** :new:\n\nEscolha qual vai ser a raridade desse item:${raritiesText}\n\nDigite o número da opção ou \`cancel\` para cancelar.`);
                })
                .then(msg => {
                    // rarity
                    oldMsg = msg;
                    return channel.awaitMessages(m => {
                        if (m.content === 'cancel') {
                            return true;
                        }
                        const v = parseInt(m.content);
                        return v >= 1 && v <= GACHA_RARITIES.length;
                    }, { max: 1, time: 30000, errors: ['time'] })
                })
                .then(collected => {
                    // escolhendo rarity
                    if (oldMsg) {
                        oldMsg.delete();
                        oldMsg = null;
                    }
                    const response = collected.first().content;

                    if (response === 'cancel') {
                        return Promise.reject(collected);
                    }

                    itemSelected.rarity = parseInt(response) - 1;

                    // color/icon msg
                    switch (itemSelected.type) {
                        case 0: // role
                            return channel.send(`:game_die: **Criando um novo item** :new:\n\nDigite uma cor, em hexadecimal, que a role vai ter.\n\nDigite a cor (exemplo: \`#fc0000\`) ou \`cancel\` para cancelar.`);
                        case 1: // icon
                            return channel.send(`:game_die: **Criando um novo item** :new:\n\nDigite um emoji para ser o ícone. Deve ser um emoji default, não pode ser um emoji personalizado.\n\nDigite o emoji (exemplo: :smiley:) ou \`cancel\` para cancelar.`);
                        case 2: // troll
                            return channel.send(`:game_die: **Criando um novo item** :new:\n\nDigite um emoji para ser o ícone. Pode ser um emoji default ou emoji personalizado, desde que seja DESTE server.\n\nDigite o emoji (exemplo: :dance:) ou \`cancel\` para cancelar.`);
                    }
                })
                .then(msg => {
                    // color/icon
                    oldMsg = msg;
                    return channel.awaitMessages(m => {
                        if (m.content === 'cancel') {
                            return true;
                        }
                        switch (itemSelected.type) {
                            case 0: // role
                                return m.content.match(/^#[0-9a-fA-F]{6}$/);
                            case 1: // icon
                                return m.content.match(/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]$/u);
                            case 2: // troll
                                return m.content.match(/^<:[^:]+:\d+>$/) || m.content.match(/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]$/u);
                        }
                    }, { max: 1, time: 30000, errors: ['time'] })
                })
                .then(collected => {
                    // escolhendo cor/icon
                    if (oldMsg) {
                        oldMsg.delete();
                        oldMsg = null;
                    }
                    const response = collected.first().content;

                    if (response === 'cancel') {
                        return Promise.reject(collected);
                    }

                    switch (itemSelected.type) {
                        case 0: // role
                            itemSelected.color = response;
                            break;
                        case 1: // icon
                            itemSelected.icon = response;
                            break;
                        case 2: // troll
                            break;
                    }

                    // texto msg
                    return channel.send(`:game_die: **Criando um novo item** :new:\n\nDigite o nome desse item. Exemplos:\n **Marrom-cocô** (se for uma role)\n **Murro na poc** (se for um icone tipo :left_facing_fist:)\n **Um avatar da polly** (se for um item troll)\n\nDigite o nome do item ou \`cancel\` para cancelar.`);
                })
                .then(msg => {
                    // texto
                    oldMsg = msg;
                    return channel.awaitMessages(m => {
                        // if (m.content === 'cancel') {
                        //     return true;
                        // }
                        return true;
                    }, { max: 1, time: 30000, errors: ['time'] })
                })
                .then(collected => {
                    // escolhendo cor/icon
                    if (oldMsg) {
                        oldMsg.delete();
                        oldMsg = null;
                    }
                    const response = collected.first().content;

                    if (response === 'cancel') {
                        return Promise.reject(collected);
                    }

                    itemSelected.name = response;

                    // concluido, criar
                    return Promise.resolve(itemSelected);
                })
                .then(item => {
                    switch (itemSelected.type) {
                        case 0: // role
                            return createRole(guild, member, item.color, item.rarity, item.name);
                        case 1: // icon
                            return Promise.reject(`Ainda não terminei.`);
                        case 2: // troll
                            return Promise.reject(`Ainda não terminei.`);
                    }
                })
                .then(item => {
                    return message.reply(`:white_check_mark: Item ${formatItem(guild, item)} criado com sucesso.`);
                })
                .catch(error => {
                    if (oldMsg) {
                        oldMsg.delete();
                        oldMsg = null;
                    }
                    if (error instanceof Map) {
                        message.reply(`:x: Cancelado.`);
                    } else {
                        console.error(error);
                        message.reply(`:x: ${error}`);
                    }
                })
            ;

            /*const type = args.shift();

            switch (type) {
                case 'role':
            }*/

            // const rarity = rarityLetterToNumber(args.shift());
            // const color = args.shift();
            // const nome = args.join(' ');
            //
            // if (rarity === false) {
            //     const lettersText = GACHA_RARITIES.map(r => '`' + r.letter + '`').join(', ');
            //     message.reply(`:x: Raridade incorreta. Deve ser uma das letras: ${lettersText}`);
            //     return;
            // }

            // createRole(guild, member, color, rarity, nome).then(item => {
            //     return message.reply(`:white_check_mark: Role ${formatItem(guild, item)} criada com sucesso.`);
            // }).catch(error => {
            //     console.error(error);
            //     message.reply(`:x: ${error}`);
            // });

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

            const query = args.join(' ');

            const filter = (item) => {
                if (item.type === 'role') {
                    return item.color === query
                        || item.name === query
                    ;
                } else {
                    return item.name === query;
                }
            };

            findByFilter(filter).then(item => {
                if (!item) {
                    message.reply(`:x: Item não encontrado.`);
                    return;
                }

                deleteItem(guild, member, item).then((oldItem) => {
                    return message.reply(`:white_check_mark: Item \`${query}\` excluído com sucesso.`);
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

            db.getArray('roles')
                .then(items => {
                    let foundItems = '';

                    items.forEach(item => {
                        foundItems += `\n:small_blue_diamond: `
                            + (isDebug ? `(<@${item.author}>) ` : '')
                            + formatItem(guild, item)
                        ;
                    });

                    if (!foundItems) {
                        message.reply(`:x: Nenhum item de gacha registrado. Aguarde os admins criarem novos itens.`);
                        return;
                    }

                    utils.sendLongMessage(message.channel, `:gift: Itens disponíveis:${foundItems}`);
                })
                .catch(error => {
                    console.error(error);
                    message.reply(`:x: ${error}`);
                })
            ;

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

            // skipa qualquer open de gacha que tiver em andamento
            db.save('skip/' + member.id, 1);

            const defaultInfo = {
                roles: {},
                tokens: GACHA_INITIAL_TOKENS
            };

            db.getOne('info/' + member.id, defaultInfo)
                .then(info => {
                    const filter = (item, id) => {
                        // vê se .roles[id] for maior do que zero
                        // .roles[id] é o numero de itens possuídos pelo usuario
                        return info.roles[item.id];
                    };

                    db.findAll('roles', filter)
                        .then(items => {
                            let foundItems = '';
                            let itemIndex = 1;

                            items.forEach(item => {
                                foundItems += `\n:small_blue_diamond: `
                                    + `\`[${itemIndex}]\` `
                                    + `${info.roles[item.id]}x `
                                    + formatItem(guild, item, false, info.equip === item.id)
                                    + (info.equip === item.id ? ' *[Equipado]*' : '');

                                itemIndex++;
                            });

                            if (!foundItems) {
                                foundItems = `\n*Você não possui nenhum item.*`;
                            } else {
                                foundItems += `\n\nPara equipar um item, use \`+gacha equip (número do item)\`.`;
                            }

                            utils.sendLongMessage(message.channel, `${member},\nSeus tokens: **${info.tokens}**\n\nSeus itens:${foundItems}`);
                        })
                        .catch(error => {
                            console.error(error);
                            message.reply(`:x: ${error}`);
                        })
                    ;

                })
                .catch(error => {
                    console.error(error);
                    message.reply(`:x: ${error}`);
                })
            ;

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

            const defaultInfo = {
                roles: {},
                tokens: GACHA_INITIAL_TOKENS
            };

            db.getOne('info/' + member.id, defaultInfo)
                .then(info => {
                    let oldEquip, newEquip;

                    const filter = (item, id) => {
                        // vê se .roles[id] for maior do que zero
                        // .roles[id] é o numero de itens possuídos pelo usuario
                        return info.roles[item.id];
                    };

                    db.findAll('roles', filter)
                        .then(items => {
                            let foundItems = 0;
                            let itemIndex = 1;

                            items.forEach(item => {
                                // old equip
                                if (info.equip === item.id) {
                                    oldEquip = item;
                                }

                                // new equip
                                if (itemIndex === equipIndex) {
                                    newEquip = item;
                                }

                                foundItems++;
                                itemIndex++;
                            });

                            if (!foundItems) {
                                message.reply(`:x: Você não possui nenhum item.`);
                                return;
                            }

                            if (!newEquip) {
                                message.reply(`:x: Item \`${equipIndex}\` não existe. Digite um número de 1 a ${foundItems}.`);
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

                                    db.save('info/' + member.id, info)
                                        .then(newInfo => {
                                            message.reply(`:white_check_mark: Item ${formatItem(guild, newEquip)} ` + (isEquip ? 'equipado' : 'desequipado') + '.');
                                        })
                                        .catch(err => {
                                            console.error(err);
                                            message.reply(`:x: ${err}`);
                                        })
                                    ;
                                })
                                .catch(error => {
                                    console.error(error);
                                    message.reply(`:x: ${error}`);
                                })
                            ;

                        })
                        .catch(error => {
                            console.error(error);
                            message.reply(`:x: ${error}`);
                        })
                    ;

                })
                .catch(error => {
                    console.error(error);
                    message.reply(`:x: ${error}`);
                })
            ;

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

            db.getArray('roles')
                .then(items => {
                    if (!items.length) {
                        message.reply(`:x: Nenhum item de gacha registrado. Aguarde os admins criarem novos itens.`);
                        return;
                    }

                    // tira qualquer skip que ficou de outros comandos
                    db.delete('skip/' + member.id);

                    const defaultInfo = {
                        roles: {},
                        tokens: GACHA_INITIAL_TOKENS
                    };

                    db.getOne('info/' + member.id, defaultInfo)
                        .then(info => {
                            if (info.tokens < pullCostTotal && !isDebug) {
                                message.reply(`:x: Você não tem token suficiente. Seus tokens: **${info.tokens}**. Você precisa: **${pullCostTotal}**.`);
                                return;
                            }

                            let itemsWon = [];
                            let news = [];
                            let maxRarityWon = 0;
                            // se o numero de pulls for maior que 10, ganha
                            // uma chance extra de tirar um item com raridade alta
                            let minimumGachaRarityExtraChance = pullTimes >= 10 ? GACHA_EXTRA_CHANCE_MULTIPLIER : 0;

                            // 1x pull do gacha
                            for (let t = 0; t < pullTimes; t++) {
                                let maxShuffle = 10000;

                                // garantia de chance, raridade alta
                                if (minimumGachaRarityExtraChance > 0) {
                                    // pegando o maxShuffle e multiplicando pela
                                    // chance de uma raridade mais alta,
                                    // garante que o luckyNumber vai ser menor
                                    // e consequentemente, ganhando uma raridade mais alta
                                    maxShuffle *= GACHA_RARITIES[1].chance;

                                    minimumGachaRarityExtraChance--;
                                }

                                const luckyNumber = Math.random() * maxShuffle;

                                // encontra qual tipo de item você vai ganhar primeiro
                                let rarityWon;
                                for (let r = GACHA_RARITIES.length - 1; r >= 0; r--) {
                                    const rarityFactor = 10000 * GACHA_RARITIES[r].chance;

                                    if (luckyNumber <= rarityFactor) {
                                        rarityWon = r;
                                        break;
                                    }
                                }
                                maxRarityWon = Math.max(maxRarityWon, rarityWon);

                                console.log('RARITY WON', rarityWon);

                                // agora, entre os itens, encontra qual deles vc vai ganhar, baseado
                                // na raridade que você tirou
                                let possibleItems = [];
                                items.forEach(item => {
                                    if (item.rarity === rarityWon) {
                                        possibleItems.push(item);
                                    }
                                });
                                // for (let id in items) {
                                //     if (!items.hasOwnProperty(id)) continue;
                                //     const item = items[id];
                                //
                                //     if (item.rarity === rarityWon) {
                                //         possibleItems.push(item);
                                //     }
                                // }

                                console.log('POSSIBLE ITEMS', possibleItems);

                                // embaralha itens
                                possibleItems = utils.shuffle(possibleItems);

                                // ...e pego aleatoriamente um aleatoriamente
                                let idx = parseInt((Math.random() * (possibleItems.length * 2000)) / 2000);
                                idx = Math.min(possibleItems.length - 1, idx);
                                const itemWon = possibleItems[idx];

                                // coloca no hash de itens ganhos
                                itemsWon.push(itemWon);

                                if (!isDebug) {
                                    info.tokens -= GACHA_PULL_COST;
                                }
                            }
                            // --- fim do for dos pulls

                            console.log('WON', itemsWon);

                            // adiciona os itens ganhos no seu inventario
                            for (let i = 0; i < itemsWon.length; i++) {
                                const item = itemsWon[i];
                                info.roles[item.id] = info.roles[item.id] || 0;
                                news.push(info.roles[item.id] === 0);
                                info.roles[item.id]++;
                            }

                            // salva e mostra os ganhos do gacha
                            db.save('info/' + member.id, info)
                                .then(newInfo => {

                                    let skip = false;
                                    // vai ficar escutando esse valor no db,
                                    // e quanto esse valor for true, ele vai mudar
                                    // a variavel skip = true e o open do gacha vai ser skipado
                                    const endSkip = db.getLive('skip/' + member.id, val => {
                                        if (val) {
                                            skip = true;
                                            db.delete('skip/' + member.id);
                                        }
                                    });

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

                                        wonText += `\n\nSeu novo saldo de tokens: **${info.tokens}**`;

                                        msg.edit(`${member},\n:slot_machine: Resultado do seu pull:\n${wonText}`).then(() => {
                                            if (countOpened > 0) {
                                                if (skip) {
                                                    _open(msg, 0);
                                                    return;
                                                }
                                                message.client.setTimeout(() => {
                                                    _open(msg, countOpened - 1);
                                                }, 1700);
                                            } else {
                                                // quando termina a animação de open do gacha
                                                // não precisa mais ter o listen lá de cima.
                                                // então, finaliza
                                                endSkip();
                                            }
                                        }).catch(err => {
                                            // se deu algum erro, tentar revelar tudo de uma vez
                                            console.error(err);
                                            _open(msg, 0);
                                        });
                                    }

                                    message.reply(`\n:slot_machine: Resultado do seu pull:
\n:game_die: Carregando resultados :game_die:`)
                                        .then(msg => {
                                            if (maxRarityWon >= 2) {
                                                // se for A pra cima, dar uma dica do que vem
                                                // através do react de "festa".
                                                // isso é como se fosse a cor das luzes
                                                // no gacha do bandori quando vem uma 3*+
                                                msg.react('🎉');
                                            }
                                            _open(msg, itemsWon.length);
                                        })
                                    ;
                                })
                                .catch(error => {
                                    console.error(error);
                                    message.reply(`:x: ${error}`);
                                })
                            ;

                        })
                        .catch(error => {
                            console.error(error);
                            message.reply(`:x: ${error}`);
                        })
                    ;
                })
                .catch(error => {
                    console.error(error);
                    message.reply(`:x: ${error}`);
                })
            ;

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

            const defaultInfo = {
                roles: {},
                tokens: GACHA_INITIAL_TOKENS
            };

            db.getOne('info/' + member.id, defaultInfo)
                .then(info => {
                    // temporario para guardar o que foi trocado pra mostrar
                    // pro usuário depois
                    let exchanges = {};
                    for (let r = GACHA_RARITIES.length - 1; r >= 0; r--) {
                        exchanges[r] = 0;
                    }

                    const filter = (item, id) => {
                        // vê se .roles[id] for maior do que zero
                        // .roles[id] é o numero de itens possuídos pelo usuario
                        return info.roles[item.id];
                    };

                    db.findAll('roles', filter)
                        .then(items => {
                            if (!items.length) {
                                message.reply(`:x: Nenhum item de gacha registrado. Aguarde os admins criarem novos itens.`);
                                return;
                            }

                            let foundItemsCount = 0;
                            // let itemIndex = 1;

                            items.forEach(item => {
                                if (info.roles[item.id] > 1) {

                                    // pega só os itens repetidos e deixa apenas um
                                    const itemCountToExchange = info.roles[item.id] - 1;
                                    info.roles[item.id] = 1;

                                    exchanges[item.rarity] += itemCountToExchange;
                                    foundItemsCount++;
                                }
                            });

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

                            // salva e mostra os tokens ganhos
                            db.save('info/' + member.id, info)
                                .then(newInfo => {
                                    message.reply(text);
                                })
                                .catch(error => {
                                    console.error(error);
                                    message.reply(`:x: ${error}`);
                                })
                            ;

                        })
                        .catch(error => {
                            console.error(error);
                            message.reply(`:x: ${error}`);
                        })
                    ;

                })
                .catch(error => {
                    console.error(error);
                    message.reply(`:x: ${error}`);
                })
            ;

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
                            if (member.user.bot) return;
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
                                const defaultInfo = {
                                    roles: {},
                                    tokens: GACHA_INITIAL_TOKENS
                                };
                                db.getOne('info/' + member.id, defaultInfo)
                                    .then(info => {
                                        info.tokens += tokenSums[member.id];

                                        return db.save('info/' + member.id, info);
                                    })
                                    .catch(console.error)
                                ;
                            }
                        });

                        console.log('TOKEN SUMS', tokenSums);
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
            if (found) {
                reject(`A role ${formatItem(guild, found)} já existe.`);
            } else {
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
                                const item = {
                                    type: GACHA_ITEM_TYPES[0].type,
                                    role: role.id,
                                    emoji: emoji.id,
                                    author: user.id,
                                    rarity: rarity,
                                    color: color,
                                    colorDecimal: colorNumber,
                                    name: name
                                };

                                db.insert('roles', item)
                                    .then(item => {
                                        re(item);
                                    })
                                    .catch(err => {
                                        // deu erro no banco, deleta o emoji pra reverter alterações
                                        guild.deleteEmoji(emoji, 'Erro ao salvar, revertendo');
                                        rj(err);
                                    })
                                ;

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
            }
        }).catch(reject);
    });
}

function findByFilter(filter) {
    return new Promise((resolve, reject) => {
        db.findOne('roles', filter)
            .then(item => {
                if (item !== null) {
                    resolve(item);
                } else {
                    resolve(null);
                }
            })
            .catch(reject)
        ;
    });
}

function findByColor(color) {
    return new Promise((resolve, reject) => {
        db.findOne('roles', (item) => item.color === color)
            .then(item => {
                if (item !== null) {
                    resolve(item);
                } else {
                    resolve(null);
                }
            })
            .catch(reject)
        ;
    });
}

function deleteItem(guild, user, item) {
    const reason = `Excluído por comando gacha por @${user.username}`;
    return new Promise((resolve, reject) => {
        if (item.type === 'role') {
            guild.deleteEmoji(item.emoji, reason)
                .then(() => {
                    // deletou emoji
                    const role = guild.roles.get(item.role);
                    role.delete(reason)
                        .then(() => {
                            // deletou role
                            db.delete('roles/' + item.id)
                                .then(oldItem => {
                                    // deletado com sucesso
                                    resolve(oldItem);
                                }, reject);
                        }, reject);
                }, reject);
        } else {
            db.delete('roles/' + item.id)
                .then(oldItem => {
                    // deletado com sucesso
                    resolve(oldItem);
                }, reject);
        }
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