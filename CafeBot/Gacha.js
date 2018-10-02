
const utils = require('../utils');
const ADMIN_IDS = require('../adminIds');
const Discord = require("discord.js");
const Jimp = require('jimp');
const GIFEncoder = require('gifencoder');

const Cafebase = require('./Cafebase');
const db = new Cafebase('gacha');

const InterativePrompt = require('./Util/InterativePrompt');
const randomNumber = require('./Util/RandomNumber');

const GACHA_TYPES = {
    ROLE: 0,
    ICON: 1,
    TROLL: 2,
    GAME: 3
};
const GACHA_ITEM_TYPES = [
    { type: 'role', name: 'Role (cor)', limited: false, canEquip: true, mustHaveAmount: 1 },
    { type: 'icon', name: 'Ícone no nickname', limited: false, canEquip: true, mustHaveAmount: 1 },
    { type: 'troll', name: 'Troll (item sem valor)', limited: false, canEquip: false, mustHaveAmount: 0 },
    { type: 'game', name: 'Jogo', limited: true, canEquip: false, mustHaveAmount: 0 },
];

const GACHA_RARITIES = [
    { letter: 'C', emojiLetter: ':regional_indicator_c:', chance: 1.0000, exchange: 5 },
    { letter: 'B', emojiLetter: ':regional_indicator_b:', chance: 0.0300, exchange: 10 },
    { letter: 'A', emojiLetter: ':regional_indicator_a:', chance: 0.0010, exchange: 25 },
    { letter: 'S', emojiLetter: ':regional_indicator_s:', chance: 0.0002, exchange: 50 },
];

let GACHA_PULL_COST = 100;
const GACHA_MAX_PULLS = 10;
let GACHA_INITIAL_TOKENS = 800;
let GACHA_EXTRA_CHANCE_MULTIPLIER = 1;

let GACHA_DAILY_TOKENS = 80;
let GACHA_DAILY_DAY = 24 * 60 * 60; // 1 dia
let GACHA_DAILY_BONUS_STREAK = 10; // em dias
let GACHA_DAILY_BONUS_STREAK_TOKENS = 300;

let GACHA_TOKEN_DROP_FREQUENCY = 5; // em minutos
let GACHA_TOKEN_DROP_AMOUNT_MIN = 3;
let GACHA_TOKEN_DROP_AMOUNT = 12;
let GACHA_TOKEN_DROP_AMOUNT_MULTIPLIER = 1;
let GACHA_TOKEN_DROP_MAX_TIMESTAMP = 7 * 24 * 60 * 60000; // em milissegundos

let GACHA_EXTRA_TOKENS_CHANNEL = '346798009050333184';
let GACHA_EXTRA_TOKENS_PRIZE = 600;
let GACHA_EXTRA_TOKENS_REACT_GIVE = 20;
let GACHA_EXTRA_TOKENS_REACT_RECEIVED = 11;
let GACHA_EXTRA_TOKENS_MAX_REACTS = 5;

let GACHA_TIER_C_CHANNEL = '495237582012022794';
let GACHA_TIER_B_CHANNEL = '495237607836352532';
let GACHA_TIER_A_CHANNEL = '495237633560150057';
let GACHA_TIER_S_CHANNEL = '495237654544121857';
let GACHA_LOG_CHANNEL = '495576950891610118';

const GACHA_VALID_CHANNELS_EARN_TOKENS = [
    '213797930937745409', // mesa
    '430684220306882561', // jogos
    '346798009050333184', // desenhos
    '414209945576275968', // selfie
];

// cache pra saber se tal pessoa está mudando o nick ou não, pro evento não ser disparado em loop infinito
let GACHA_CHANGING_NICK = {};

// cache pra saber quem ta tirando pull no momento, pra evitar race condition e exploitar tokens infinitos, por ex.
let GACHA_ONGOING_PULL = {};

db.refreshConfig(config => {
    GACHA_PULL_COST = config.pullCost || 100;
    GACHA_INITIAL_TOKENS = config.initialTokens || 800;
    GACHA_EXTRA_CHANCE_MULTIPLIER = config.extraChanceMultiplier || 1;

    GACHA_DAILY_TOKENS = config.dailyTokens || 80;
    GACHA_DAILY_DAY = config.dailyOneDay || (24 * 60 * 60); // 1 dia
    GACHA_DAILY_BONUS_STREAK = config.dailyBonusStreak || 10; // em dias
    GACHA_DAILY_BONUS_STREAK_TOKENS = config.dailyBonusStreakTokens || 300;

    GACHA_TOKEN_DROP_FREQUENCY = config.tokenDropFrequency || 5; // em minutos
    GACHA_TOKEN_DROP_AMOUNT_MIN = config.tokenDropAmountMin || 3;
    GACHA_TOKEN_DROP_AMOUNT = config.tokenDropAmount || 12;
    GACHA_TOKEN_DROP_AMOUNT_MULTIPLIER = config.tokenDropAmountMultiplier || 1;
    GACHA_TOKEN_DROP_MAX_TIMESTAMP = config.tokenDropMaxTimestampDecay || (7 * 24 * 60 * 60000); // em milissegundos

    GACHA_EXTRA_TOKENS_CHANNEL = config.extraTokensChannel || '346798009050333184';
    GACHA_EXTRA_TOKENS_PRIZE = config.extraTokensPrize || 600;
    GACHA_EXTRA_TOKENS_REACT_GIVE = config.extraTokensReactGive || 20;
    GACHA_EXTRA_TOKENS_REACT_RECEIVED = config.extraTokensReactReceived || 11;
    GACHA_EXTRA_TOKENS_MAX_REACTS = config.extraTokensMaxReacts || 5;

    GACHA_TIER_C_CHANNEL = config.tierCChannel || '495237582012022794';
    GACHA_TIER_B_CHANNEL = config.tierBChannel || '495237607836352532';
    GACHA_TIER_A_CHANNEL = config.tierAChannel || '495237633560150057';
    GACHA_TIER_S_CHANNEL = config.tierSChannel || '495237654544121857';
    GACHA_LOG_CHANNEL = config.logChannel || '495576950891610118';
});

class Gacha {
    constructor () {}

    static get name() { return 'gacha' }

    static gachaCommand(message, args) {
        const arg = args.shift();
        const isDebug = args.includes('--debug') && hasPermission(message);
        switch (arg) {
            case 'create':
            case 'c':
                return Gacha.gachaCreateCommand(message, args);
            case 'delete':
            case 'del':
                return Gacha.gachaDeleteCommand(message, args);
            case 'info':
            case 'stats':
            case 'i':
                return Gacha.gachaInfoCommand(message, args);
            case 'tokens':
            case 't':
                return Gacha.gachaInfoTokensCommand(message, args);
            case 'keep':
                return Gacha.gachaKeepCommand(message, args);
            case 'list':
            case 'l':
                return Gacha.gachaListCommand(message, args);
            case 'equip':
                return Gacha.gachaEquipCommand(message, args);
            case 'exchange':
                return Gacha.gachaExchangeCommand(message, args);
            case 'bonus':
            case 'daily':
            case 'd':
                return Gacha.gachaDailyCommand(message, args);
            case 'pull':
            case 'roll':
            case 'p':
                return Gacha.gachaPullCommand(message, args);
            case 'testdm':
                return Gacha.gachaTestDMCommand(message, args);
            case 'draw':
                return Gacha.gachaDrawCommand(message, args);
            case 'punish':
                return Gacha.gachaPunishCommand(message, args);
            case 'help':
                return Gacha.gachaHelpCommand(message, args);
            case 'refreshreacts':
                updateExtraTokensReacts(message.client, isDebug);
                return;
            case 'refreshnicks':
                return Gacha.gachaRefreshNicknamesCommand(message, args);
            default:
                const adminCommands = hasPermission(message) ? ['create', 'delete', 'draw', 'punish'] : [];
                const commands = adminCommands.concat(['info', 'list', 'equip', 'exchange', 'pull', 'keep', 'bonus', 'testdm']).map(c => `\`${c}\``).join(', ');
                message.reply(`:x: Comando inexistente.\nComandos disponíveis: ${commands} ou \`help\` para mais detalhes.`);
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

            const prompt = InterativePrompt.create(channel, member, `:game_die: \`+gacha create\` **Criando um novo item** :new:`, 30000)
                .addPrompt(
                    'prompt-type',
                    `Escolha o tipo de item a ser criado: ${typesText}`,
                    `Digite o número da opção`,
                    response => {
                        const v = parseInt(response);
                        return v >= 1 && v <= GACHA_ITEM_TYPES.length;
                    },
                    (choice, prompt) => {
                        prompt.setChoice('type', parseInt(choice) - 1);
                        prompt.setNext('prompt-rarity');
                    }
                )
                .addPrompt(
                    'prompt-rarity',
                    `Escolha qual vai ser a raridade desse item: ${raritiesText}`,
                    `Digite o número da opção`,
                    response => {
                        const v = parseInt(response);
                        return v >= 1 && v <= GACHA_RARITIES.length;
                    },
                    (choice, prompt) => {
                        prompt.setChoice('rarity', parseInt(choice) - 1);

                        switch (prompt.getChoice('type')) {
                            case GACHA_TYPES.ROLE:
                                prompt.setNext('prompt-color');
                                break;
                            case GACHA_TYPES.ICON:
                                prompt.setNext('prompt-icon-default');
                                break;
                            case GACHA_TYPES.TROLL:
                                prompt.setNext('prompt-icon');
                                break;
                            case GACHA_TYPES.GAME:
                                prompt.setChoice('emoji', '🎮');
                                prompt.setNext('prompt-game-link');
                                break;
                        }
                    }
                )
                .addPrompt(
                    'prompt-color',
                    `Digite uma cor, em hexadecimal, que a role vai ter.\nExemplo: **#fc00a3**`,
                    `Digite a cor`,
                    response => {
                        return response.match(/^#[0-9a-fA-F]{6}$/);
                    },
                    (choice, prompt) => {
                        prompt.setChoice('color', choice);
                        prompt.setNext('prompt-name');
                    }
                )
                .addPrompt(
                    'prompt-game-link',
                    `Digite o link (com \\<\\> em volta) que resgata o jogo, ou se o jogo for gift pela Steam, digite o link pro seu usuário. Se for uma key (Origin, Uplay, outros), digite a key. \nExemplo:\n **\\<<https://www.humblebundle.com/gift?key=ABCDE>\\>** (se for link do Humble Bundle)\n**\\<<https://steamcommunity.com/id/ABCDE>\\>** (se for gift no seu inventário da steam)`,
                    `Digite um link ou key`,
                    response => {
                        return !response.startsWith(utils.prefix);
                    },
                    (choice, prompt) => {
                        prompt.setChoice('link', choice);
                        prompt.setNext('prompt-name');
                    }
                )
                .addPrompt(
                    'prompt-icon-default',
                    `Digite um emoji para ser o ícone. Deve ser um emoji default, não pode ser um emoji personalizado.\nExemplo: :smiley:`,
                    `Digite o emoji`,
                    response => {
                        return response.match(/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]$/u);
                    },
                    (choice, prompt) => {
                        prompt.setChoice('emoji', choice);
                        prompt.setNext('prompt-name');
                    }
                )
                .addPrompt(
                    'prompt-icon',
                    `Digite um emoji para ser o ícone. Pode ser um emoji default ou emoji personalizado, desde que seja DESTE server.\nExemplo: <:dance:463542150475546653>`,
                    `Digite o emoji`,
                    response => {
                        return response.match(/^<:[^:]+:\d+>$/) || response.match(/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]$/u);
                    },
                    (choice, prompt) => {
                        prompt.setChoice('emoji', choice);
                        prompt.setNext('prompt-name');
                    }
                )
                .addPrompt(
                    'prompt-name',
                    `Digite o nome desse item. Exemplos:
 **Marrom-cocô** (se for uma role)
 **Murro na poc** (se for um icone tipo :left_facing_fist:)
 **Um avatar da polly** (se for um item troll)`,
                    `Digite o nome`,
                    response => {
                        return !response.startsWith(utils.prefix);
                    },
                    (choice, prompt) => {
                        prompt.setChoice('name', choice);
                    }
                )
            ;

            // começa o prompt
            prompt.start('prompt-type')
                .then(itemSelected => {
                    switch (itemSelected.type) {
                        case GACHA_TYPES.ROLE:
                            return createRole(guild, member, itemSelected.color, itemSelected.rarity, itemSelected.name, itemSelected);
                        case GACHA_TYPES.ICON:
                        case GACHA_TYPES.TROLL:
                        case GACHA_TYPES.GAME:
                            return createItem(guild, member, itemSelected);
                    }
                })
                .then(item => {
                    return message.reply(`:white_check_mark: Item ${formatItem(guild, item)} criado com sucesso.`);
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

                const confirmationCode = parseInt((Math.random() * 8000) + 1000);
                const prompt = InterativePrompt.create(message.channel, member, null, 30000)
                    .addPrompt(
                        'prompt-confirmation',
                        `:wastebasket: Tem certeza que quer deletar o item ${formatItem(guild, item)}?`,
                        `Digite \`${confirmationCode}\` para confirmar`,
                        response => {
                            return parseInt(response) === confirmationCode;
                        },
                        (choice, prompt) => {
                            prompt.setChoice('code', parseInt(choice));
                        }
                    );

                prompt.start('prompt-confirmation')
                    .then(choices => {
                        if (choices.code === confirmationCode) {
                            return deleteItem(guild, member, item);
                        }
                    })
                    .then((oldItem) => {
                        return message.reply(`:white_check_mark: Item \`${oldItem.name}\` excluído com sucesso.`);
                    })
                    .catch(error => {
                        console.error(error);
                        message.reply(`:x: ${error}`);
                    })
                ;

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
     * Marca uma mensagem onde o usuário que fez ganha um prêmio em tokens, e
     * quem dar reacts na mensagem dele também ganha alguns tokens.
     * Usado pros requests de desenho.
     *
     * @param message
     * @param args
     */
    static gachaDrawCommand(message, args) {
        try {
            if (!hasPermission(message)) {
                message.reply(`:x: *Você não tem permissão de usar esse comando.*`);
                return;
            }
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);
            const channel = guild.channels.get(GACHA_EXTRA_TOKENS_CHANNEL);

            const messageId = args.shift();

            if (!messageId) {
                message.reply(`:x: Digite um ID de mensagem.`);
                return;
            }

            channel.fetchMessage(messageId)
                .then(foundMessage => {
                    db.findOne('drawings', d => d.message === foundMessage.id)
                        .then(foundDraw => {
                            if (foundDraw) {
                                return message.reply(`:x: Mensagem já está marcada como desenho.`);
                            }
                            const draw = {
                                message: foundMessage.id,
                                channel: channel.id,
                                reacts: {}
                            };
                            db.insert('drawings', draw)
                                .then(draw => {
                                    const memberPrizeId = foundMessage.author.id;
                                    return modifyInfo(memberPrizeId, info => {
                                        console.log('DRAW PRIZE TOKEN', memberPrizeId, info.tokens);
                                        info.tokens += GACHA_EXTRA_TOKENS_PRIZE;
                                        return info;
                                    });
                                })
                                .then(() => {
                                    return message.reply(`:white_check_mark: Mensagem marcada como desenho com sucesso.`);
                                })
                                .catch(error => {
                                    console.error(error);
                                    message.reply(`:x: ${error}`);
                                })
                            ;
                        })
                    ;
                })
                .catch(error => {
                    message.reply(`:x: ${error}`);
                })
            ;

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /**
     * Pune um usuário em uma quantidade de tokens.
     *
     * @param message
     * @param args
     */
    static gachaPunishCommand(message, args) {
        try {
            if (!hasPermission(message)) {
                message.reply(`:x: *Você não tem permissão de usar esse comando.*`);
                return;
            }
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            const userId = args.shift();
            const punishAmount = parseInt(args.shift());

            if (!userId) {
                message.reply(`:x: Comando incorreto. Use \`+gacha punish (id usuário) (quantidade tokens)\``);
                return;
            }

            if (punishAmount < 0 || punishAmount > 9999) {
                message.reply(`:x: KKKKKKKK. Não. :slight_smile:`);
                return;
            }

            const modifyFn = info => {
                console.log('PUNISH TOKEN', userId, info.tokens);
                info.tokens -= punishAmount;
                return info;
            };

            modifyInfo(userId, modifyFn)
                .then((info) => {
                    try {
                        guild.channels.get(GACHA_LOG_CHANNEL).send(`**Punição**\nUsuário <@${userId}> foi punido em ${punishAmount} token(s).`).catch(console.log);
                    } catch (e) { console.log(e) }
                    return message.reply(`:white_check_mark: Usuário <@${userId}> foi punido em ${punishAmount} token(s) com sucesso. Novo saldo: **${info.tokens}**`);
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

            const only = args.shift();

            db.getArray('roles')
                .then(items => {
                    let foundItems = '';

                    items.sort((a, b) => {
                        if (b.rarity - a.rarity === 0) {
                            return a.name.localeCompare(b.name);
                        }
                        return (b.rarity - a.rarity);
                    });

                    if (only) {
                        let filter;
                        switch (only) {
                            case 'cores':
                            case 'colors':
                            case 'c':
                            case 'roles':
                                filter = (i) => {
                                    return i.type === GACHA_TYPES.ROLE;
                                };
                                break;
                            case 'icones':
                            case 'emojis':
                            case 'i':
                            case 'icons':
                                filter = (i) => {
                                    return i.type === GACHA_TYPES.ICON;
                                };
                                break;
                            case 'games':
                            case 'jogos':
                            case 'g':
                            case 'j':
                                filter = (i) => {
                                    return i.type === GACHA_TYPES.GAME;
                                };
                                break;
                        }

                        items = items.filter(filter);
                    }

                    items.forEach(item => {
                        if (isDebug || !item.owner) {
                            foundItems += `\n:small_blue_diamond: `
                                + (isDebug ? `(criado: <@${item.author}>) ` : '')
                                + (isDebug && item.owner ? `(dono: <@${item.owner}>) ` : '')
                                + formatItem(guild, item)
                            ;
                        }
                    });

                    if (!foundItems) {
                        if (only) {
                            message.reply(`:x: Nenhum item de gacha deste tipo no momento.`);
                        } else {
                            message.reply(`:x: Nenhum item de gacha registrado. Aguarde os admins criarem novos itens.`);
                        }
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

            getInfo(member)
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
                                    + (GACHA_ITEM_TYPES[item.type].canEquip ? `\`[${itemIndex}]\` ` : `\`[ ]\` `)
                                    + `${info.roles[item.id]}x `
                                    + formatItem(guild, item, false, info)
                                    + (info.equip[item.type] === item.id ? ' *[Equipado]*' : '');

                                if (GACHA_ITEM_TYPES[item.type].canEquip) {
                                    itemIndex++;
                                }
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
     * Mostra os tokens do usuário.
     *
     * @param message
     * @param args
     */
    static gachaInfoTokensCommand(message, args) {
        try {
            const isDebug = args.includes('--debug') && hasPermission(message);
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            getInfo(member)
                .then(info => {
                    message.reply(`Seus tokens: **${info.tokens}**`);
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
     * Marca um item para ele nunca sumir no exchange
     *
     * @param message
     * @param args
     */
    static gachaKeepCommand(message, args) {
        try {
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            const channel = message.channel;

            getInfo(member)
                .then(info => {
                    const filter = (item, id) => {
                        // vê se .roles[id] for maior do que zero
                        // .roles[id] é o numero de itens possuídos pelo usuario
                        // e pega só os itens C
                        return info.roles[item.id] && item.rarity === 0;
                    };

                    db.findAll('roles', filter)
                        .then(items => {

                            if (items.length === 0) {
                                message.reply(`:x: Você não possui nenhum item.`);
                                return;
                            }

                            let pages = [];
                            let pageLength = 10;
                            let pageIndex = 0;
                            let itemIndex = 1;

                            items.forEach(item => {
                                pages[pageIndex] = pages[pageIndex] || '';
                                pages[pageIndex] += `\n:small_blue_diamond: `
                                    + `\`[${itemIndex}]\` `
                                    + formatItem(guild, item, false, false)
                                    + (info.keep.includes(item.id) ? ' *[Mantido]*' : '');

                                itemIndex++;

                                if (itemIndex % pageLength === 0) {
                                    pageIndex++;
                                }
                            });

                            const prompt = InterativePrompt.create(channel, member, `:game_die: \`+gacha keep\` **Mantendo um item**`, 60000)
                                .addPromptPagination(
                                    'prompt-item',
                                    `Escolha o item a ser mantido (ou desmantido, caso já esteja):`,
                                    pages,
                                    `Digite o número do item`,
                                    response => {
                                        const v = parseInt(response);
                                        return v >= 1 && v <= items.length;
                                    },
                                    (choice, prompt) => {
                                        prompt.setChoice('item', parseInt(choice) - 1);
                                    }
                                )
                            ;

                            prompt.start('prompt-item')
                                .then(choice => {

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

            const prompt = InterativePrompt.create(channel, member, `:game_die: **Criando um novo item** :new:`, 30000)
                .addPrompt(
                    'prompt-type',
                    `Escolha o tipo de item a ser criado: ${typesText}`,
                    `Digite o número da opção`,
                    response => {
                        const v = parseInt(response);
                        return v >= 1 && v <= GACHA_ITEM_TYPES.length;
                    },
                    (choice, prompt) => {
                        prompt.setChoice('type', parseInt(choice) - 1);
                        prompt.setNext('prompt-rarity');
                    }
                )
                .addPrompt(
                    'prompt-rarity',
                    `Escolha qual vai ser a raridade desse item: ${raritiesText}`,
                    `Digite o número da opção`,
                    response => {
                        const v = parseInt(response);
                        return v >= 1 && v <= GACHA_RARITIES.length;
                    },
                    (choice, prompt) => {
                        prompt.setChoice('rarity', parseInt(choice) - 1);

                        switch (prompt.getChoice('type')) {
                            case GACHA_TYPES.ROLE:
                                prompt.setNext('prompt-color');
                                break;
                            case GACHA_TYPES.ICON:
                                prompt.setNext('prompt-icon-default');
                                break;
                            case GACHA_TYPES.TROLL:
                                prompt.setNext('prompt-icon');
                                break;
                            case GACHA_TYPES.GAME:
                                prompt.setChoice('emoji', '🎮');
                                prompt.setNext('prompt-game-link');
                                break;
                        }
                    }
                )
                .addPrompt(
                    'prompt-color',
                    `Digite uma cor, em hexadecimal, que a role vai ter.\nExemplo: **#fc00a3**`,
                    `Digite a cor`,
                    response => {
                        return response.match(/^#[0-9a-fA-F]{6}$/);
                    },
                    (choice, prompt) => {
                        prompt.setChoice('color', choice);
                        prompt.setNext('prompt-name');
                    }
                )
                .addPrompt(
                    'prompt-game-link',
                    `Digite o link (com \\<\\> em volta) que resgata o jogo, ou se o jogo for gift pela Steam, digite o link pro seu usuário. Se for uma key (Origin, Uplay, outros), digite a key. \nExemplo:\n **\\<<https://www.humblebundle.com/gift?key=ABCDE>\\>** (se for link do Humble Bundle)\n**\\<<https://steamcommunity.com/id/ABCDE>\\>** (se for gift no seu inventário da steam)`,
                    `Digite um link ou key`,
                    response => {
                        return !response.startsWith(utils.prefix);
                    },
                    (choice, prompt) => {
                        prompt.setChoice('link', choice);
                        prompt.setNext('prompt-name');
                    }
                )
                .addPrompt(
                    'prompt-icon-default',
                    `Digite um emoji para ser o ícone. Deve ser um emoji default, não pode ser um emoji personalizado.\nExemplo: :smiley:`,
                    `Digite o emoji`,
                    response => {
                        return response.match(/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]$/u);
                    },
                    (choice, prompt) => {
                        prompt.setChoice('emoji', choice);
                        prompt.setNext('prompt-name');
                    }
                )
                .addPrompt(
                    'prompt-icon',
                    `Digite um emoji para ser o ícone. Pode ser um emoji default ou emoji personalizado, desde que seja DESTE server.\nExemplo: <:dance:463542150475546653>`,
                    `Digite o emoji`,
                    response => {
                        return response.match(/^<:[^:]+:\d+>$/) || response.match(/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]$/u);
                    },
                    (choice, prompt) => {
                        prompt.setChoice('emoji', choice);
                        prompt.setNext('prompt-name');
                    }
                )
                .addPrompt(
                    'prompt-name',
                    `Digite o nome desse item. Exemplos:
 **Marrom-cocô** (se for uma role)
 **Murro na poc** (se for um icone tipo :left_facing_fist:)
 **Um avatar da polly** (se for um item troll)`,
                    `Digite o nome`,
                    response => {
                        return !response.startsWith(utils.prefix);
                    },
                    (choice, prompt) => {
                        prompt.setChoice('name', choice);
                    }
                )
            ;

            // começa o prompt
            prompt.start('prompt-type')
                .then(itemSelected => {
                    switch (itemSelected.type) {
                        case GACHA_TYPES.ROLE:
                            return createRole(guild, member, itemSelected.color, itemSelected.rarity, itemSelected.name, itemSelected);
                        case GACHA_TYPES.ICON:
                        case GACHA_TYPES.TROLL:
                        case GACHA_TYPES.GAME:
                            return createItem(guild, member, itemSelected);
                    }
                })
                .then(item => {
                    return message.reply(`:white_check_mark: Item ${formatItem(guild, item)} criado com sucesso.`);
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
     * Equipa um item no usuário.
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

            getInfo(member)
                .then(info => {
                    let oldEquip = {}, newEquip;

                    const filter = (item, id) => {
                        // vê se .roles[id] for maior do que zero
                        // .roles[id] é o numero de itens possuídos pelo usuario
                        return info.roles[item.id] && GACHA_ITEM_TYPES[item.type].canEquip;
                    };

                    db.findAll('roles', filter)
                        .then(items => {
                            let foundItems = 0;
                            let itemIndex = 1;

                            items.forEach(item => {
                                // old equip
                                if (info.equip[item.type] === item.id) {
                                    oldEquip[item.type] = item;
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
                            const isEquip = (!oldEquip[newEquip.type] || (newEquip.id !== oldEquip[newEquip.type].id));

                            let unequipFunction = (equipItem) => {
                                switch (equipItem.type) {
                                    case GACHA_TYPES.ROLE:
                                        return member.removeRole(equipItem.role);
                                    case GACHA_TYPES.ICON:
                                        return removeEmojiToNickname(member, equipItem.emoji);
                                    default:
                                        return Promise.resolve();
                                }
                            };

                            let equipFunction = (equipItem) => {
                                switch (equipItem.type) {
                                    case GACHA_TYPES.ROLE:
                                        return member.addRole(equipItem.role);
                                    case GACHA_TYPES.ICON:
                                        return addEmojiToNickname(member, equipItem.emoji);
                                    default:
                                        return Promise.resolve();
                                }
                            };

                            if (!isEquip) {
                                // desequipar
                                equipPromise = unequipFunction(newEquip);
                            } else {
                                // equipar e tirar a antiga, se tiver
                                equipPromise = equipFunction(newEquip)
                                    .then(() => {
                                        if (oldEquip[newEquip.type]) {
                                            return unequipFunction(oldEquip[newEquip.type]);
                                        }
                                        return Promise.resolve();
                                    });
                            }
                            equipPromise
                                .then(() => {
                                    // muda info
                                    info.equip[newEquip.type] = isEquip ? newEquip.id : null;

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

            if (GACHA_ONGOING_PULL[member.id]) {
                message.reply(`:x: Pull em andamento. Aguarde alguns segundos antes de mandar outro.`);
                return;
            }

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

                    // transaction do pull começa aqui ---
                    GACHA_ONGOING_PULL[member.id] = true;

                    getInfo(member)
                        .then(info => {
                            if (info.tokens < pullCostTotal && !isDebug) {
                                message.reply(`:x: Você não tem token suficiente. Seus tokens: **${info.tokens}**. Você precisa: **${pullCostTotal}**.`);
                                // transaction do pull termina toda vez que há um termino repentino ---
                                delete GACHA_ONGOING_PULL[member.id];
                                return;
                            }

                            let itemsWon = [];
                            let news = [];
                            let maxRarityWon = 0;
                            // se o numero de pulls for maior que 10, ganha
                            // uma chance extra de tirar um item com raridade alta
                            let minimumGachaRarityExtraChance = pullTimes >= 10 ? GACHA_EXTRA_CHANCE_MULTIPLIER : 0;

                            // 1x pull do gacha
                            let luckyNumberPromises = [];
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

                                luckyNumberPromises.push(randomNumber(0, maxShuffle));
                            }

                            Promise.all(luckyNumberPromises)
                                .then((luckyNumbers) => {
                                    // dá uma embaralhada nos numeros sorteados pra
                                    // os itens não aparecerem muito sequenciais
                                    luckyNumbers = utils.shuffle(luckyNumbers);

                                    // 1x pull do gacha
                                    for (let t = 0; t < pullTimes; t++) {
                                        // pega o numero sorteado
                                        const luckyNumber = luckyNumbers[t];

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
                                            if (item.rarity === rarityWon && !item.owner) {
                                                possibleItems.push(item);
                                            }
                                        });

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

                                    let itemsToSave = [];

                                    // adiciona os itens ganhos no seu inventario
                                    for (let i = 0; i < itemsWon.length; i++) {
                                        const item = itemsWon[i];

                                        // cria o item no inventario do usuario, caso não tenha
                                        info.roles[item.id] = info.roles[item.id] || 0;

                                        // indica se é um item novo pro usuario
                                        news.push(info.roles[item.id] === 0);

                                        // adiciona +1
                                        info.roles[item.id]++;

                                        if (GACHA_ITEM_TYPES[item.type].limited) {
                                            // se o item é um do tipo limitado, marcar o dono do item nele
                                            item.owner = member.id;
                                            itemsToSave.push(['roles/' + item.id, item])
                                        }
                                    }

                                    // salva e mostra os ganhos do gacha
                                    //console.log('TO SAVE', [['info/' + member.id, info]].concat(itemsToSave));
                                    db.saveAll([['info/' + member.id, info]].concat(itemsToSave))
                                        .then(([newInfo, ...newItems]) => {

                                            // tá salvo, transaction pode terminar tranquilo a partir daqui ---
                                            delete GACHA_ONGOING_PULL[member.id];

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

                                                wonText += `\n\nSeus tokens: **${info.tokens}**`;

                                                msg.edit(`${member},\n:slot_machine: Resultado do seu pull:\n${wonText}`).then(() => {
                                                    if (countOpened > 0) {
                                                        if (skip) {
                                                            _open(msg, 0);
                                                            return;
                                                        }
                                                        message.client.setTimeout(() => {
                                                            _open(msg, countOpened - 1);
                                                        }, 2000);
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

                                            message.reply(`\n:slot_machine: Resultado do seu pull:\n:game_die: Carregando resultados :game_die:`)
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
                                            // transaction do pull termina toda vez que há um termino repentino ---
                                            delete GACHA_ONGOING_PULL[member.id];
                                        })
                                    ;
                                })
                                .catch(error => {
                                    console.error(error);
                                    message.reply(`:x: Não foi possível sortear seus prêmios. Tente novamente. ${error}`);
                                    // transaction do pull termina toda vez que há um termino repentino ---
                                    delete GACHA_ONGOING_PULL[member.id];
                                })
                            ;

                        })
                        .catch(error => {
                            console.error(error);
                            message.reply(`:x: ${error}`);
                            // transaction do pull termina toda vez que há um termino repentino ---
                            delete GACHA_ONGOING_PULL[member.id];
                        })
                    ;
                })
                .catch(error => {
                    console.error(error);
                    message.reply(`:x: ${error}`);

                    // transaction do pull termina toda vez que há um termino repentino ---
                    delete GACHA_ONGOING_PULL[member.id];
                })
            ;

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);

            // transaction do pull termina toda vez que há um termino repentino ---
            delete GACHA_ONGOING_PULL[member.id];
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

            getInfo(member)
                .then(info => {
                    // temporario para guardar o que foi trocado pra mostrar
                    // pro usuário depois
                    let exchanges = {};
                    for (let r = GACHA_RARITIES.length - 1; r >= 0; r--) {
                        exchanges[r] = 0;
                    }
                    exchanges['games'] = [];

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
                                // quantidade minima que deve sobrar no inventario.
                                // se 0, significa que não vai sobrar nenhum no seu inventario
                                // exemplo: itens trolls servem somente pra trocar por dinheiro
                                let mustHaveAmount = GACHA_ITEM_TYPES[item.type].mustHaveAmount;
                                if (info.roles[item.id] > mustHaveAmount) {

                                    // pega só os itens repetidos e deixa apenas um
                                    const itemCountToExchange = info.roles[item.id] - mustHaveAmount;
                                    if (mustHaveAmount > 0) {
                                        info.roles[item.id] = mustHaveAmount;
                                    } else {
                                        info.roles[item.id] = null; // deleta
                                    }

                                    if (item.type === GACHA_TYPES.GAME && item.owner === member.id) {
                                        // se for do tipo jogo, dar direto pro usuario
                                        exchanges['games'].push(item);
                                    } else {
                                        // só vira token o que não for jogo
                                        exchanges[item.rarity] += itemCountToExchange;
                                    }

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

                            if (exchanges['games'].length) {
                                text += `\n\n**Jogo(s) resgatado(s):**`;
                                exchanges['games'].forEach(gameItem => {
                                    text += `\n`
                                        + ':small_blue_diamond: '
                                        + formatItem(guild, gameItem)
                                    ;
                                })
                            }

                            // soma os tokens novos
                            info.tokens += sumTokensExchange;

                            text += `\n\nSeu novo saldo de tokens: **${info.tokens}**`;

                            let beforeSavePromise;
                            if (exchanges['games'].length) {
                                // se teve jogo, tentar enviar via DM pra ele primeiro
                                beforeSavePromise = new Promise(resolve => {
                                    const p = member.createDM()
                                        .then(dm => {
                                            function formatLinkGame(item, code) {
                                                if (item.link.match(/steam/)) {
                                                    return `O jogo é um gift da Steam. Faça amizade com esta pessoa (${item.link}) e informe este código para ela: \`[${code}]\``;
                                                }
                                                return `${item.link} (caso tenha problemas em resgatar, avise algum dos admins informando esse código: \`[${code}]\``;
                                            }

                                            let giftText = ':gift: Jogos resgatados do gacha Café com Pão!';
                                            let logText = `**Resgate de jogos**\n${member} está resgatando os seguintes jogos:`;
                                            exchanges['games'].forEach(gameItem => {
                                                const code = parseInt((Math.random() * 8000) + 1000);
                                                giftText += `\n\n  `
                                                    + formatItem(guild, gameItem)
                                                    + "\n"
                                                    + formatLinkGame(gameItem, code)
                                                ;

                                                logText += `\n  `
                                                    + formatItem(guild, gameItem)
                                                    + ` - Criado por <@${gameItem.author}> - Código de segurança \`[${code}]\``
                                                ;
                                            });

                                            giftText += `\n\nSiga as instruções de cada jogo pra resgatar. Dúvidas, falar com algum dos admins para te ajudar.`;

                                            return dm.send(giftText).then(() => {
                                                try {
                                                    guild.channels.get(GACHA_LOG_CHANNEL).send(logText).catch(console.log);
                                                } catch (e) { console.log(e) }
                                            });
                                        })
                                    ;

                                    p.then(() => {
                                        // deu tudo certo, continua no save info
                                        resolve();
                                    }).catch(() => {
                                        // deu algum erro, provavelmente de privacidade que o usuario não aceita DM
                                        // do bot. então deixar avisado, mas tirar os jogos do info como ganhos e avisar
                                        text += `\n\n:exclamation: **Atenção**: o(s) jogo(s) não foi(ram) resgatados. Digite \`+gacha testdm\` e veja se o bot consegue enviar DM para você. Caso não, verifique suas configurações de privacidade.`;
                                        // volta os items pro inventario do usuario
                                        exchanges['games'].forEach(gameItem => {
                                            info.roles[gameItem.id] = 1;
                                        });
                                        resolve();
                                    })
                                });
                            } else {
                                beforeSavePromise = Promise.resolve();
                            }

                            beforeSavePromise.then(() => {
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
                            });

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
     * Daily.
     * Tem bonus se pegar todos os dias.
     *
     * @param message
     * @param args
     */
    static gachaDailyCommand(message, args) {
        try {
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            const now = new Date();

            const modifyFn = info => {
                console.log('INFO', info);
                if (info.daily.lastTs) {
                    const remainingSecs = parseInt((now.getTime() - info.daily.lastTs) / 1000);
                    if (remainingSecs < GACHA_DAILY_DAY) {
                        const remainingText = formatTime(GACHA_DAILY_DAY - remainingSecs);
                        message.reply(`:x: Você já resgatou seu bônus. Aguarde **${remainingText}** para o próximo.`);
                        return;
                    }

                    // verifica se ainda tá dentro de menos de 2 dias.
                    // se passou de 2 dias, reseta o bonus
                    if (remainingSecs >= (GACHA_DAILY_DAY * 2)) {
                        info.daily.streak = 0;
                    }
                }

                if (!info.daily.streak || info.daily.streak >= GACHA_DAILY_BONUS_STREAK) {
                    info.daily.streak = 0;
                }

                // guarda a ultima vez q fez daily
                info.daily.lastTs = now.getTime();
                info.daily.streak++;

                console.log('DAILY TOKEN', member.id, info.tokens, GACHA_DAILY_TOKENS);
                info.tokens += GACHA_DAILY_TOKENS;

                // bonus!
                if (info.daily.streak >= GACHA_DAILY_BONUS_STREAK) {
                    console.log('DAILY BONUS TOKEN', member.id, info.tokens, GACHA_DAILY_BONUS_STREAK_TOKENS);
                    info.tokens += GACHA_DAILY_BONUS_STREAK_TOKENS;
                }

                console.log('INFO END', info);
                return info;
            };

            modifyInfo(member.id, modifyFn)
                .then((info) => {
                    if (info) {
                        let bonusText = '';
                        let firstRowText = '', secondRowText = '';
                        for (let i = 1; i <= GACHA_DAILY_BONUS_STREAK; i++) {
                            firstRowText += (i === GACHA_DAILY_BONUS_STREAK) ? `🎉` : `<:r0:461676744185741322>`;
                            secondRowText += (i <= info.daily.streak) ? `🆗` : `⬛`;
                        }
                        bonusText += ``
                            + firstRowText
                            + "\n"
                            + secondRowText
                            + (info.daily.streak === GACHA_DAILY_BONUS_STREAK ? ` **BÔNUS!**` : '')
                            + "\n"
                        ;
                        return message.reply(`:white_check_mark: Você coletou seu bônus!\n${bonusText}\nVolte em ${formatTime(GACHA_DAILY_DAY)} para mais um bônus.\nNovo saldo: **${info.tokens}**`);
                    }
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
     * Comando pra testar se o bot consegue mandar DM pra pessoa.
     *
     * @param message
     * @param args
     */
    static gachaTestDMCommand(message, args) {
        try {
            const isDebug = args.includes('--debug') && hasPermission(message);
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            member.createDM()
                .then(dm => {
                    return dm.send(':white_check_mark: Teste de DM com sucesso. Está mensagem se apagará automaticamente em alguns segundos.')
                        .then(m => {
                            message.client.setTimeout(() => { m.delete() }, 10000);
                        });
                })
                .catch(err => {
                    //console.error(err);
                    message.reply(`:x: Não foi possível criar uma DM com você. Verifique as suas configurações de privacidade para permitir que o bot mande mensagens diretas para você.`);
                })
            ;

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /**
     * Tira o icone de todos os usuários que não tem o icone equipado.
     *
     * @param message
     * @param args
     */
    static gachaRefreshNicknamesCommand(message, args) {
        try {
            const isDebug = args.includes('--debug') && hasPermission(message);
            const guild = getCafeComPaoGuild(message);
            const member = getCafeComPaoMember(guild, message);

            guild.members.forEach(guildMember => {
                getInfo(guildMember)
                    .then(info => {
                        let oldNickname = guildMember.nickname || guildMember.user.username;
                        let newNickname = oldNickname;
                        const equip = info.equip[GACHA_TYPES.ICON];

                        db.findAll('roles', item => item.type === GACHA_TYPES.ICON)
                            .then(items => {
                                let itemToEquip = null;
                                items.forEach(item => {
                                    // tira qualquer icone que o usuario tiver
                                    newNickname = newNickname.replace(new RegExp(item.emoji, 'g'), '');

                                    if (item.id === equip) {
                                        itemToEquip = item;
                                    }
                                });

                                newNickname = newNickname.trim();

                                // se o nick ficar vazio, usar o username
                                if (!newNickname) {
                                    newNickname = guildMember.user.username;
                                }

                                // depois coloca emoji, se tiver equipado
                                if (itemToEquip) {
                                    newNickname = itemToEquip.emoji + ' ' + newNickname;
                                }

                                if (newNickname !== oldNickname) {
                                    console.log('REFRESH NICK ALTER', newNickname);

                                    // marca que tá sendo alterado o nick, para não disparar o evento de mudança de nick
                                    console.log('->', guildMember.user.username, oldNickname, newNickname);
                                    GACHA_CHANGING_NICK[guildMember.id] = true;
                                    guildMember.setNickname(newNickname, 'Automático anti-exploit do +gacha')
                                        .then(() => {
                                            delete GACHA_CHANGING_NICK[guildMember.id];
                                        })
                                        .catch((error) => {
                                            delete GACHA_CHANGING_NICK[guildMember.id];
                                            console.error(error);
                                        })
                                    ;
                                }

                            }, console.error)
                        ;
                    }, console.error)
                ;
            })

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

            // a cada X minutos, só que no minuto segunte
            if ((minutes - 1) % GACHA_TOKEN_DROP_FREQUENCY === 0) {
                updateExtraTokensReacts(client);
            }

            // a cada X minutos
            if (minutes % GACHA_TOKEN_DROP_FREQUENCY === 0) {

                guild.fetchMembers()
                    .then(() => {
                        let tokenSums = {};

                        guild.members.forEach(member => {
                            if (member.user.bot) return;
                            /*for (let c = 0; c < GACHA_VALID_CHANNELS.length; c++) {
                                const channel = guild.channels.get(GACHA_VALID_CHANNELS[c]);
                            }*/
                            const lastMessage = member.lastMessage;

                            console.log('MEMBER', member.id, date.getTime(), (lastMessage || {}).createdTimestamp);

                            if (lastMessage) {
                                const diff = date.getTime() - lastMessage.createdTimestamp;
                                const min = GACHA_TOKEN_DROP_MAX_TIMESTAMP, max = 0;

                                // numero pelo qual, quando multiplicado, quanto mais perto do minimo, mais "zero" ele fica,
                                // e quanto mais perto do maximo, mais "um" ele fica
                                const penaltyRatio = Math.min(1, Math.max(0, (diff - min) / (max - min)));

                                let tokensToEarn = ((Math.random() * GACHA_TOKEN_DROP_AMOUNT) + GACHA_TOKEN_DROP_AMOUNT_MIN) * GACHA_TOKEN_DROP_AMOUNT_MULTIPLIER;
                                tokensToEarn *= penaltyRatio;

                                // coloca nos tokens pra ganhar
                                tokenSums[member.id] = parseInt(tokensToEarn);

                                // salva
                                const modifyFn = info => {
                                    console.log('DROP TOKEN', member.id, info.tokens, tokenSums[member.id]);
                                    info.tokens += tokenSums[member.id];
                                    return info;
                                };

                                modifyInfo(member.id, modifyFn)
                                    .then((info) => {
                                        // salvo com sucesso
                                    })
                                    .catch(error => {
                                        console.error(error);
                                    })
                                ;
                                // getInfo(member)
                                //     .then(info => {
                                //         info.tokens += tokenSums[member.id];
                                //
                                //         return db.save('info/' + member.id, info);
                                //     })
                                //     .catch(console.error)
                                // ;
                            }
                        });

                        //console.log('TOKEN SUMS', tokenSums);
                    });

            }
        } catch (error) {
            console.error(error);
        }
    }

    static onReactionAdd(messageReaction, user) {
        // let reactCount = messageReaction.count;
        // messageReaction.fetchUsers()
        //     .then(users => {
        //         if (users && !users.some(u => adminsIds.includes(u.id))) {
        //             // ignora quem não for admin
        //             return;
        //         }
        //
        //         if (reactCount > 0 && messageReaction.emoji.name === '🔞') {
        //             // marcar essa mensagem como nsfw
        //             return messageReaction.message.delete();
        //         }
        //     })
        //     .then(msg => {
        //         if (msg) {
        //             return createNsfwAlert(msg, true);
        //         }
        //     })
        //     .catch(console.error);
    }

    /**
     * Atualiza o nick do usuario se ele mudar pra poder equipar o icone de acordo.
     *
     * @param oldMember
     * @param newMember
     */
    static onGuildMemberUpdate(oldMember, newMember) {
        if (GACHA_CHANGING_NICK[newMember.id]) {
            //delete GACHA_CHANGING_NICK[newMember.id];
            return;
        }
        let oldNickname = oldMember.nickname || oldMember.user.username;
        let newNickname = newMember.nickname || newMember.user.username;
        if (oldNickname !== newNickname) {
            getInfo(newMember)
                .then(info => {
                    const equip = info.equip[GACHA_TYPES.ICON];

                    db.findAll('roles', item => item.type === GACHA_TYPES.ICON)
                        .then(items => {
                            let itemToEquip = null;
                            items.forEach(item => {
                                // tira qualquer icone que o usuario tiver
                                newNickname = newNickname.replace(new RegExp(item.emoji, 'g'), '');

                                if (item.id === equip) {
                                    itemToEquip = item;
                                }
                            });

                            newNickname = newNickname.trim();

                            // se o nick ficar vazio, usar o username
                            if (!newNickname) {
                                newNickname = newMember.user.username;
                            }

                            // depois coloca emoji, se tiver equipado
                            if (itemToEquip) {
                                newNickname = itemToEquip.emoji + ' ' + newNickname;
                            }

                            if (newNickname !== oldNickname) {
                                console.log('NICK A', newNickname);

                                // marca que tá sendo alterado o nick, para não disparar o evento de mudança de nick
                                GACHA_CHANGING_NICK[newMember.id] = true;
                                newMember.setNickname(newNickname, 'Automático anti-exploit do +gacha')
                                    .then(() => {
                                        delete GACHA_CHANGING_NICK[newMember.id];
                                    })
                                    .catch((error) => {
                                        delete GACHA_CHANGING_NICK[newMember.id];
                                        console.error(error);
                                    })
                                ;
                            }

                        }, console.error)
                    ;
                }, console.error)
            ;
        }
    }

    static onReady(client) {
        // db.getLiveCollection('drawings', (event, draw) => {
        //     try {
        //         if (event === 'changed') {
        //             const guild = getCafeComPaoGuild(client);
        //             const channel = guild.channels.get(draw.channel || GACHA_EXTRA_TOKENS_CHANNEL);
        //
        //             channel.fetchMessage(messageId)
        //                 .then(foundMsg => {
        //                     const draw = {
        //                         message: foundMsg.id,
        //                         channel: channel.id,
        //                         reacts: {}
        //                     };
        //                     db.save('drawings', draw)
        //                         .then(draw => {
        //                             message.reply(`:white_check_mark: Mensagem marcada como desenho com sucesso.`);
        //                         })
        //                         .catch(error => {
        //                             console.error(error);
        //                             message.reply(`:x: ${error}`);
        //                         })
        //                     ;
        //                 })
        //                 .catch(error => {
        //                     message.reply(`:x: ${error}`);
        //                 })
        //             ;
        //         }
        //     } catch (e) {
        //         console.error(e);
        //     }
        // });

    }

    static onMessage(message) {
        Gacha.gachaCreateOnMessage(message)
    }

    static onMessageDelete(message) {
        Gacha.gachaCreateOnMessage(message, 'delete')
    }

    static onMessageUpdate(oldMessage, newMessage) {
        Gacha.gachaCreateOnMessage(newMessage, 'update', oldMessage)
    }

    /**
     *
     * @param message
     * @param mode
     * @param oldMessage
     */
    static gachaCreateOnMessage(message, mode, oldMessage) {
        // se não tiver um channel
        if (!message.channel || message.author.bot) return;

        // ignora msgs pinadas e do sistema (avisos de pin)
        if (message.pinned || message.system) return;

        // se não for um dos channels de cadastro
        if (![GACHA_TIER_C_CHANNEL, GACHA_TIER_B_CHANNEL, GACHA_TIER_A_CHANNEL, GACHA_TIER_S_CHANNEL].includes(message.channel.id)) return;

        // se não for admin, ignora
        if (!hasPermission(message)) return;

        const guild = getCafeComPaoGuild(message);
        const member = getCafeComPaoMember(guild, message);

        if (mode === 'delete') {
            db.findOne('roles', item => item.byMessage === message.id)
                .then(item => {
                    if (item) {
                        console.log('DELETED ITEM GACHA (MSG)', message.content);
                        return deleteItem(guild, member, item)
                            .catch(err => {
                                message.channel.send(':x: Houve um erro ao apagar esse item. Apague manualmente usando `+gacha delete ' + item.name + '` no <#240297584420323338>');
                            });
                    }
                })
            ;
            return;
        }

        let parts = message.content.trim().split(/\s+/);
        let left = parts.shift();
        let right = parts.join(' ');

        let rarity = 0;
        if (message.channel.id === GACHA_TIER_B_CHANNEL) rarity = 1;
        if (message.channel.id === GACHA_TIER_A_CHANNEL) rarity = 2;
        if (message.channel.id === GACHA_TIER_S_CHANNEL) rarity = 3;

        if (mode === 'update') {
            db.findOne('roles', item => item.byMessage === message.id)
                .then(item => {
                    if (item) {
                        return message.clearReactions()
                            .then(() => {
                                if (item.type === GACHA_TYPES.ROLE) {
                                    item.name = right;
                                    return guild.roles.get(item.role).edit({ name: right })
                                        .then(() => {
                                            console.log('UPDATED ROLE GACHA (MSG)', message.content);
                                            return db.save('roles/' + item.id, item).then(() => {
                                                return markValid(message, item.emoji);
                                            })
                                        })
                                    ;
                                } else {
                                    item.name = right;
                                    console.log('UPDATED ITEM GACHA (MSG)', message.content);
                                    return db.save('roles/' + item.id, item).then(() => {
                                        return markValid(message, item.emoji);
                                    })
                                    /*.catch(err => {
                                        message.channel.send(':x: Houve um erro ao apagar esse item. Apague manualmente usando `+gacha delete ' + item.name + '` no <#240297584420323338>');
                                    });*/
                                }
                            })
                        ;
                    }
                })
            ;
            return;
        }

        function markInvalid(message) {
            console.log('INVALID ITEM GACHA (MSG)', message.content);
            return message.react('❌');
        }

        function markValid(message, newEmoji) {
            console.log('CREATED ITEM GACHA (MSG)', message.content);
            return message.react('✅')
                .then(() => {
                    if (newEmoji) {
                        return message.react(newEmoji);
                    }
                });
        }

        // valida
        if (!left || !right) {
            markInvalid(message);
            return;
        }

        // primeiro ve se já não existe
        db.findAll('roles', item => {
            return (item.emoji === left || item.color === left || item.name === right);
        })
            .then(items => {
                if (items.length > 0) {
                    markInvalid(message);
                    return;
                }

                switch (message.channel.id) {
                    case GACHA_TIER_C_CHANNEL:
                        // só itens trolls
                        if (!left.match(/^<:[^:]+:\d+>$/) && !left.match(/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]$/u)) {
                            markInvalid(message);
                            return;
                        }

                        createItem(guild, member, {
                            type: GACHA_TYPES.TROLL,
                            rarity: rarity,
                            emoji: left,
                            name: right,
                            messageId: message.id
                        }).then(() => {
                            return markValid(message);
                        });
                        return;
                    case GACHA_TIER_B_CHANNEL:
                    case GACHA_TIER_A_CHANNEL:
                    case GACHA_TIER_S_CHANNEL:
                        // só roles ou icones
                        if (!left.match(/^#[0-9a-fA-F]{6}$/) && !left.match(/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]$/u)) {
                            markInvalid(message);
                            return;
                        }

                        if (left.match(/^#[0-9a-fA-F]{6}$/)) {
                            // role
                            createRole(guild, member, left, rarity, right, { messageId: message.id })
                                .then((item) => {
                                    return markValid(message, item.emoji);
                                })
                                .catch(() => markInvalid(message))
                            ;
                        } else {
                            // icon
                            createItem(guild, member, {
                                type: GACHA_TYPES.ICON,
                                rarity: rarity,
                                emoji: left,
                                name: right,
                                messageId: message.id
                            })
                                .then(() => {
                                    return markValid(message);
                                })
                                .catch(() => markInvalid(message))
                            ;
                        }

                        return;

                } // --- fim do switch case
            })
        ;


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
            //'messageReactionAdd': Gacha.onReactionAdd,
            'message': Gacha.onMessage,
            'ready': Gacha.onReady,
            'messageDelete': Gacha.onMessageDelete,
            'messageUpdate': Gacha.onMessageUpdate,
            'guildMemberUpdate': Gacha.onGuildMemberUpdate
        }
    }

    static gachaHelpCommand(message, args) {
        let text = '__*Comandos disponíveis*__:\n';

        if (hasPermission(message)) {
            // comandos de admin
            text += ''
                + `\`+gacha create\`\n`
                + `Abre um menu interativo pra criação de um item de gacha.\n`
                + `\n`
                + `\`+gacha delete (nome do item)\`\n`
                + `Excluí um item de gacha pelo nome. O nome deve ser exatamente o mesmo, incluindo acentos e letras maiúsculas.\n`
                + `Por exemplo, se o nome de um item é "iTeM De GáCHa", o comando deve ser \`+gacha delete iTeM De GáCHa\`\n`
                + `\n`
                + `\`+gacha draw (id da mensagem)\`\n`
                + `Marca a mensagem do membro como *válido* para receber seus ${GACHA_EXTRA_TOKENS_PRIZE} tokens `
                + `de recompensa por ter participado de um request de desenhos.\n`
                + `Exemplo de uso: \`+gacha draw 495929392275390466\`\n`
                + `\n`
                + `\`+gacha punish (user id) (quantidade)\`\n`
                + `Pune um usuário numa quantidade de tokens.\n`
                + `\n`
            ;
        }

        text += ''
            + `\`+gacha info\` ou \`+gacha stats\`\n`
            + `Informa seus tokens e items adquiridos.\n`
            + `\n`
            + `\`+gacha list\`\n`
            + `Mostra uma lista com todos os itens disponíveis do gacha.\n`
            + `\n`
            + `\`+gacha equip (número do item)\`\n`
            + `Equipa um dos seus items adquiridos. Você pode equipar uma *cor* e um *emoji* simultaneamente, `
            + `mas nunca duas *cores* ou dois *itens*.\n`
            + `\n`
            + `\`+gacha exchange\`\n`
            + `Troca seus itens repetidos por tokens extras (e também dá claim nos jogos que você tiver)\n`
            + `Cada item tem um valor de acordo com a raridade dele.\n`
            + `Os itens considerados lixos (maioria dos ${GACHA_RARITIES[0].emojiLetter}) serão *todos* descartados no exchange.\n`
            + `\n`
            + `\`+gacha bonus\`\n`
            + `Ganha um bônus de ${GACHA_DAILY_TOKENS} tokens a cada ${formatTime(GACHA_DAILY_DAY)}.\n`
            + `Se você manter um streak por ${GACHA_DAILY_BONUS_STREAK} bônus, você ganha um prêmio extra de ${GACHA_DAILY_BONUS_STREAK_TOKENS} tokens.\n`
            + `\n`
            + `\`+gacha pull (número)\` ou \`+gacha roll (número)\`\n`
            + `Rola um gacha.\n`
            + `Cada pull dá direito a um item, e cada item custa ${GACHA_PULL_COST} tokens. Você pode multiplicar `
            + `o número de pulls colocando uma quantidade na frente, aumentando também o custo proporcionalmente.\n`
            + `Se você rolar 10 itens de uma vez, você tem uma garantia de pelo menos ${GACHA_EXTRA_CHANCE_MULTIPLIER} ${GACHA_RARITIES[1].emojiLetter}+).\n`
            + `\`+gacha keep\`\n`
            + `Abre um menu interativo que você vai poder escolher que itens você quer sempre manter dos que `
            + `são do tipo ${GACHA_RARITIES[0].emojiLetter} no exchange.\n`
            + `\n`
            + `\n`
            + `\`+gacha testdm\`\n`
            + `Verifica se o bot consegue mandar DM direto pra você. Isso é necessário para claim de jogos do gacha. `
            + `Use esse teste para conferir se você consegue receber DM dele normalmente. Se der algum erro, `
            + `verifique suas configurações de privacidade. Caso não deseje liberar essa configuração, você `
            + `tem esse direito, porém não poderá dar claim em jogos.\n`
        ;

        utils.sendLongMessage(message.channel, text);
    }
}

function createItem(guild, user, props) {
    return new Promise((resolve, reject) => {
        if (!GACHA_ITEM_TYPES[props.type]) {
            reject(new Error('Item do tipo ' + props.type + ' não existe.'));
            return;
        }

        findByFilter((item) => item.name === props.name).then((found) => {
            if (found) {
                reject(`O item ${formatItem(guild, found)} já existe.`);
            } else {
                //const emoji = props.emoji instanceof Discord.Emoji ? props.emoji : guild.emojis.get(props.emoji);
                // salva item no db
                const item = {
                    type: props.type,
                    emoji: props.emoji,
                    author: user.id,
                    rarity: props.rarity,
                    name: props.name,
                    link: props.link || null,
                    limited: GACHA_ITEM_TYPES[props.type].limited,
                    byMessage: props.messageId || null
                };

                db.insert('roles', item)
                    .then(item => {
                        resolve(item);
                    })
                    .catch(reject)
                ;
            }
        }).catch(reject);

    });
}

function createRole(guild, user, color, rarity, name, props) {
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
                                    type: GACHA_TYPES.ROLE,
                                    role: role.id,
                                    emoji: emoji.id,
                                    author: user.id,
                                    rarity: rarity,
                                    color: color,
                                    colorDecimal: colorNumber,
                                    name: name,
                                    limited: false,
                                    byMessage: props.messageId || null
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
    return findByFilter((item) => item.color === color);
}

function deleteItem(guild, user, item) {
    const reason = `Excluído por comando gacha por @${user.username}`;
    return new Promise((resolve, reject) => {
        if (!item.type || item.type === GACHA_TYPES.ROLE) {
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

function getInfo(member) {
    const id = typeof(member) === 'string' ? member : member.id;
    let defaultInfo = {
        roles: {},
        tokens: GACHA_INITIAL_TOKENS,
        daily: {},
        keep: [],
        equip: {}
    };

    // FIXME: necessário?
    // for (let i = 0; i < GACHA_ITEM_TYPES.length; i++) {
    //     if (GACHA_ITEM_TYPES[i].canEquip) {
    //         defaultInfo.equip[i] = null;
    //     }
    // }

    return db.getOne('info/' + id, defaultInfo);
}

function modifyInfo(member, fn) {
    const id = typeof(member) === 'string' ? member : member.id;
    let defaultInfo = {
        roles: {},
        tokens: GACHA_INITIAL_TOKENS,
        daily: {},
        keep: [],
        equip: {}
    };

    return db.transactionOne('info/' + id, fn, defaultInfo);
}

function emojifyName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function formatItem(guild, item, isNew) {
    const emoji = item.emoji.match(/^\d+$/) ? guild.emojis.get(item.emoji) : item.emoji;
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

function addEmojiToNickname(member, emoji) {
    return new Promise((resolve, reject) => {
        let newNickname = member.nickname || member.user.username;
        newNickname = emoji + ' ' + newNickname;

        console.log('NICK A', newNickname);

        // marca que tá sendo alterado o nick, para não disparar o evento de mudança de nick
        GACHA_CHANGING_NICK[member.id] = true;
        member.setNickname(newNickname.trim())
            .then(resolve)
            .catch(reject)
        ;
    })
}

function removeEmojiToNickname(member, emoji) {
    return new Promise((resolve, reject) => {
        let newNickname = member.nickname || member.user.username;
        newNickname = newNickname.replace(new RegExp(emoji, 'g'), '');

        console.log('NICK R', newNickname);

        // marca que tá sendo alterado o nick, para não disparar o evento de mudança de nick
        GACHA_CHANGING_NICK[member.id] = true;
        member.setNickname(newNickname.trim())
            .then(resolve)
            .catch(reject)
        ;
    })
}

function fetchReactsFromMessage(message, oldReacts, maxReacts, _debug) {
    let reacts = {};
    return new Promise(resolve => {
        let fetchPromises = [];

        message.reactions.forEach(reaction => {
            fetchPromises.push(reaction.fetchUsers());
        });

        Promise.all(fetchPromises)
            .then(reactionsUsers => {
                let i = 0;
                message.reactions.forEach(reaction => {
                    reactionsUsers[i++].forEach(user => {
                        // o if evita contabilizar auto-reacts
                        console.log('A', user.id !== message.author.id, user.bot);
                        if (_debug || (user.id !== message.author.id && !user.bot)) {
                            reacts[user.id] = reacts[user.id] || 0;
                            reacts[user.id]++;

                            // limita o numero de reacts
                            reacts[user.id] = Math.min(maxReacts, reacts[user.id]);

                            // adiciona no old tbm pq a iteração vai ser sobre o old,
                            // assim os users que são novos vão ser considerados tbm
                            oldReacts[user.id] = oldReacts[user.id] || 0;
                        }
                    });
                });

                resolve({ reacts: reacts, oldReacts: oldReacts });
            })
        ;
    });
}

function updateNickname(member, _debug) {

}

function updateExtraTokensReacts(client, _debug) {
    db.getArray('drawings')
        .then(draws => {
            const guild = getCafeComPaoGuild(client);

            draws.forEach(draw => {
                const channel = guild.channels.get(draw.channel || GACHA_EXTRA_TOKENS_CHANNEL);

                channel.fetchMessage(draw.message)
                    .then(message => {
                        const authorUser = message.author;

                        // pega a contagem que estava
                        let oldReacts = draw.reacts || {};

                        fetchReactsFromMessage(message, oldReacts, GACHA_EXTRA_TOKENS_MAX_REACTS, _debug)
                            .then(o => {
                                let newReacts = o.reacts;
                                oldReacts = o.oldReacts;

                                console.log('DRAW OLD REACTS', oldReacts);
                                console.log('DRAW NEW REACTS', newReacts);

                                // verifica agora usuario por usuario as diferenças de react]
                                let tokensToAdd = {};
                                for (let userId in oldReacts) {
                                    let diff;
                                    if (!newReacts[userId]) {
                                        // se não tem mais no new, é pq user tirou todas suas reacts, entao tirar os tokens
                                        diff = -oldReacts[userId];
                                    } else {
                                        diff = newReacts[userId] - oldReacts[userId];
                                    }

                                    console.log('diff', diff);

                                    // o if evita o auto-like
                                    if (_debug || authorUser.id !== userId) {
                                        // para o usuario received (que fez o desenho)
                                        const tokensToAddReceived = GACHA_EXTRA_TOKENS_REACT_RECEIVED * diff;
                                        tokensToAdd[authorUser.id] = tokensToAdd[authorUser.id] || 0;
                                        tokensToAdd[authorUser.id] += tokensToAddReceived;

                                        // para o usuario give
                                        const tokensToAddGive = GACHA_EXTRA_TOKENS_REACT_GIVE * diff;
                                        tokensToAdd[userId] = tokensToAdd[userId] || 0;
                                        tokensToAdd[userId] += tokensToAddGive;
                                    }
                                }

                                console.log("TOKENS TO MODIFY", tokensToAdd);

                                // altera info por info
                                let modified = false;
                                for (let userId in tokensToAdd) {
                                    if (tokensToAdd[userId] !== 0) {
                                        modified = true;
                                        modifyInfo(userId, info => {
                                            console.log('DRAW MODIFY TOKEN', userId, info.tokens, tokensToAdd[userId]);
                                            info.tokens += tokensToAdd[userId];
                                            return info;
                                        }).catch(console.error);
                                    }
                                }

                                if (modified) {
                                    // salva os novos reacts
                                    draw.reacts = newReacts;
                                    db.save('drawings/' + draw.id, draw)
                                        .then(draw => {
                                            console.log('DRAW SAVED', draw)
                                            //message.reply(`:white_check_mark: Mensagem marcada como desenho com sucesso.`);
                                        })
                                        .catch(console.error)
                                    ;
                                }
                            })
                        ;

                        // // conta quantas reacts cada usuario deu atualmente
                        // let newReacts = {};
                        // reactions.forEach(reaction => {
                        //     console.log('REACTIONS', reaction.users.size);
                        //     reaction.users.forEach(user => {
                        //         newReacts[user.id] = newReacts[user.id] || 0;
                        //         newReacts[user.id]++;
                        //
                        //         // adiciona no old tbm pq a iteração vai ser sobre o old,
                        //         // assim os users que são novos vão ser considerados tbm
                        //         oldReacts[user.id] = oldReacts[user.id] || 0;
                        //     });
                        // });


                    })
                    .catch(error => {
                        console.error(error);
                    })
                ;
            });
        })
    ;
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

function getCafeComPaoGuild(messageOrClient) {
    let guild;
    if (messageOrClient instanceof Discord.Client) {
        guild = messageOrClient.guilds.get('213797930937745409');
    } else {
        guild = messageOrClient.guild || messageOrClient.client.guilds.get('213797930937745409');
    }
    if (!guild) {
        throw new Error("Não foi possível encontrar o Café com Pão. Algo deu muito errado...");
    }
    if (!guild.available) {
        throw new Error("Server está com outrage. Tente novamente mais tarde.");
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