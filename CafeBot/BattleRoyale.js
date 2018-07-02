
const fbAdmin = require("firebase-admin");
const fbServiceAccount = require("../misc/cafebot-2018-firebase-adminsdk-j17ic-a11e9f3222.json");
const utils = require('../utils');
const Discord = require("discord.js");
const ADMIN_IDS = require('../adminIds');

const DualMesh =     require('@redblobgames/dual-mesh');
const MeshBuilder =   require('@redblobgames/dual-mesh/create');
const Poisson = require('poisson-disk-sampling');
const SimplexNoise = require('simplex-noise');
const Map =          require('@redblobgames/mapgen2');

//const pointsInPolygon = require('points-in-polygon');


const fbApp = fbAdmin.initializeApp({
    credential: fbAdmin.credential.cert(fbServiceAccount),
    databaseURL: "https://cafebot-2018.firebaseio.com"
}, 'royale');

const db = fbApp.database();
const ref = db.ref('royale');

let tileEmojis = {};

const equips = [
    {
        // por enquanto nada ainda, vai ficar pro rpg
    }
];

const cities = [
    { name: 'San Haj', id: ['haj'], radius: 5, biomes: true },
    { name: 'Baía do glub', id: ['glub', 'baia'], radius: 3, biomes: ['BEACH'] },
    { name: 'Escola do ABC', id: ['escola', 'abc'], radius: 2, biomes: true },
    { name: 'Lago do grande mij', id: ['lago', 'mij'], radius: 2, biomes: ['LAKE', 'MARSH', 'ICE'] },
    { name: 'Floresta da decepção', id: ['floresta', 'decepção'], radius: 3, biomes: ['TEMPERATE_RAIN_FOREST', 'TEMPERATE_DECIDUOUS_FOREST'] },
];

const leveledRoles = [
    '240282044209299457', // level 0
    '240282632787591169', // level 1
    '240287430874365962', // level 2
    '240287655907164162', // level 3
    '240287808864911363', // level 4
    '316927077318393856', // level 5
];

// padrão
let MAP_WIDTH = 54;
let MAP_HEIGHT = 54;
let MAX_VISION = 5;
let MAX_DISTANCE_OBJECTS_DETECT = 15;

let MAX_WALKS = 30;
let DELAY_WALKS = 10; // em minutos
let MAX_TELEPORTS = 5;
let DELAY_TELEPORTS = 240; // em minutos

let ROYALE_CHANNEL_ID = '461224031123800101';
let DEBUG = false;

ref.child('config').on('value', snapshot => {
    let config = snapshot.val();

    if (config) {
        ROYALE_CHANNEL_ID = config.channelId || ROYALE_CHANNEL_ID;
        DEBUG = config.debug || false;
    }
});

function makeRandomInt(seed) {
    return function (n) {
        return parseInt(utils.seededRandom(seed) * n);
    };
}


/**
 *
 *
 */
class BattleRoyale {
    constructor () {}

    static get name() { return 'royale' }

    static royaleCommand(message, args) {
        //console.log('ROLES', message.guild.roles.array().map(r => `${r.id}: ${r.name}`));

        const client = message.client;
        tileEmojis = {
            empty: client.emojis.find("name", "r0"),
            areia: client.emojis.find("name", "ra"),
            oceano: client.emojis.find("name", "ro"),
            arvore: client.emojis.find("name", "rt"),
            arvore2: client.emojis.find("name", "rm"),
            player: client.emojis.find("name", "rp"),
            loot: client.emojis.find("name", "rl"),
            grama: client.emojis.find("name", "rg"),
            deserto: client.emojis.find("name", "rd"),
            rio: client.emojis.find("name", "rr"),
            city: ':house_abandoned:'
        };

        if (Math.random() < 0.2) {
            // pra garantir que leia do banco de vez em quando caso o evento lá em cima falhar
            ref.child('config').once('value', snapshot => {
                let config = snapshot.val();

                if (config) {
                    ROYALE_CHANNEL_ID = config.channelId || ROYALE_CHANNEL_ID;
                    DEBUG = config.debug || false;
                }
            });
        }

        const arg = args.shift();
        switch (arg) {
            case 'exit':
                return BattleRoyale.royaleExitCommand(message, args);
            case 'enter':
                return BattleRoyale.royaleEnterCommand(message, args);
            case 'info':
            case 'i':
            case 'stats':
                return BattleRoyale.royaleStatsCommand(message, args);
            case 'view':
            case 'vision':
            case 'look':
            case 'v':
                return BattleRoyale.royaleVisionCommand(message, args);
            case 'walk':
            case 'w':
                return BattleRoyale.royaleWalkCommand(message, args);
            case 'generate-map':
                return BattleRoyale.generateMapCommand(message, args);
            case 'view-map':
            case 'map':
                return BattleRoyale.viewMapCommand(message, args);
            case 'drop-loot':
            case 'loot':
            case 'drop':
                return BattleRoyale.dropLootCommand(message, args);
            case 'loots':
            case 'drops':
                return BattleRoyale.lootListCommand(message, args);
            case 'remove-drop':
                return BattleRoyale.removeDropLootCommand(message, args);
            case 'players':
            case 'who':
                return BattleRoyale.playersListCommand(message, args);
            case 'teleport':
            case 'tp':
                return BattleRoyale.royaleTeleportCommand(message, args);
            default:
                if (throwErrorIfNotInRoyaleChannel(message)) return;
                message.reply(`:x: Comando inexistente.\nComandos disponíveis: \`enter\`, \`exit\`, \`info/stats\`, \`view/look\`, \`walk\`, \`teleport/tp\`, \`drops/loots\`, \`players/who\``);
        }
    }

    /**
     * Faz o usuário sair do jogo.
     * Se ele tiver loot, todos eles serão espalhados pelo mapa.
     *
     * @param message
     * @param args
     */
    static royaleExitCommand(message, args) {
        if (throwErrorIfNotInRoyaleChannel(message)) return;
        const channel = getRoyaleChannel(message);
        const responseChannel = getResponseChannel(message);

        exitPlayer(message.author).then(successMsg => {
            responseChannel.send(successMsg);
            if (responseChannel.id !== channel.id) {
                // anuncia tbm no canal do jogo
                channel.send(successMsg);
            }
        }).catch(error => {
            message.reply(`:x: ${error}`);
        })
    }

    /**
     * Faz o usuário entrar no jogo.
     *
     * @param message
     * @param args
     */
    static royaleEnterCommand(message, args) {
        if (throwErrorIfNotInRoyaleChannel(message)) return;
        const channel = getRoyaleChannel(message);
        const responseChannel = getResponseChannel(message);

        let closeToCity = args.shift();

        // vai pegar as sintaxes:
        // x y
        // x,y
        // x, y
        let forcedPos = hasPermission(message) ? args.join(',').split(/,+/).slice(0, 2).map(f => parseInt(f)) : null;
        if (!forcedPos[0]) {
            forcedPos = null;
        }
        console.log('FORCED POS', forcedPos);

        createPlayer(message.author, forcedPos).then(([ exists, player ]) => {

            let text;
            if (exists) {
                text = `:thumbsup: ${message.author}, você já está no jogo!`;
            } else {
                text = `:inbox_tray: Usuário ${message.author} entrou no jogo!`;
                console.log('ENTER', player);
            }

            responseChannel.send(text);
            if (responseChannel.id !== channel.id) {
                // anuncia tbm no canal do jogo
                channel.send(text);
            }

        }).catch(error => {
            message.reply(`:x: ${error}`);
        })
    }

    /**
     * Faz o usuário teletransportar pra um lugar aleatorio.
     *
     * @param message
     * @param args
     */
    static royaleTeleportCommand(message, args) {
        if (throwErrorIfNotInRoyaleChannel(message)) return;
        const channel = getRoyaleChannel(message);
        const responseChannel = getResponseChannel(message);

        // vai pegar as sintaxes:
        // x y
        // x,y
        // x, y
        let forcedPos = hasPermission(message) ? args.join(',').split(/,+/).slice(0, 2).map(f => parseInt(f)) : null;
        if (!forcedPos[0]) {
            forcedPos = null;
        }
        console.log("FORCED POS", forcedPos);

        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([map, players, loots]) => {
            const playerId = message.author.id;
            let player = players[playerId];

            let availableTps = getTeleportsAvailable(player);

            if (availableTps < 1) {
                const timeLeft = getTimeLeftForNextTeleport(player);
                message.reply(`:x: Você não tem teleportes suficientes. Volte em **${timeLeft}** para mais.`);
                return;
            }

            // dá tp no player
            [players, loots, player] = respawnPlayer(map, players, loots, player, false, forcedPos);

            if (!player.timestampTeleports) player.timestampTeleports = [];
            player.timestampTeleports.push((new Date()).getTime());

            player.teleports = (player.teleports || 0) + 1;
            availableTps--;

            // salva o player
            ref.child(`player/${playerId}`).set(player);
            players[playerId] = player;

            const timeLeft = getTimeLeftForNextTeleport(player);
            const text = `${tileEmojis.player} O jogador <@${playerId}> foi teleportado! Seu loot foi espalhado.`;

            responseChannel.send(text + (availableTps === 0 ? ` Volte em **${timeLeft}** para mais teleportes.` : ` Você ainda tem **${availableTps}** teleportes para usar.`));
            if (responseChannel.id !== channel.id) {
                // anuncia tbm no canal do jogo
                channel.send(text);
            }


        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        });
    }

    /**
     * Mostra os stats do jogador.
     *
     * @param message
     * @param args
     */
    static royaleStatsCommand(message, args) {
        if (throwErrorIfNotInRoyaleChannel(message)) return;
        const channel = getRoyaleChannel(message);
        const responseChannel = getResponseChannel(message);

        getPlayer(message.author).then((player) => {
            const availableWalks = getWalksAvailable(player);

            const emb = new Discord.RichEmbed()
                .setColor(3447003)
                .setTitle(`Stats de ${message.author.username}`);

            emb.addField(':wavy_dash:', `${tileEmojis.player} __Informações__`, false);
            emb.addField(`Vitórias`, player.wins || 0, true);
            emb.addField(`Mortes`, player.deaths || 0, true);
            emb.addField(`Teleportes`, player.teleports || 0, true);
            emb.addField(`Total caminhado`, getDistanceName(player.walksUsed || 0), true);
            const rating = parseInt(((player.wins || 0) / Math.max(player.wins + player.deaths, 1)) * 100);
            emb.addField(`% Sucesso`, rating + '%', true);

            let text = `${message.author}, `;

            text += `Você tem **${availableWalks}** passos disponíveis no momento.`;
            if (availableWalks <= 0) {
                const timeLeft = getTimeLeftForNextWalk(player);
                text += ` Volte em **${timeLeft}** para mais passos.`;
                return;
            }

            text += "\n";

            responseChannel.send(text, {embed: emb});
        });
    }

    /**
     * Olha para uma direção e mostra os tiles até um certo ponto daquela visão
     *
     * @param message
     * @param args
     */
    static royaleVisionCommand(message, args) {
        if (throwErrorIfNotInRoyaleChannel(message)) return;
        const channel = getRoyaleChannel(message);
        const responseChannel = getResponseChannel(message);

        const _debug = isDebug(message, args);

        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([map, players, loots]) => {
            getPlayer(message.author).then(player => {

                let coord = normalizeCoord(args[0]);

                if (!coord) {
                    coord = player.lastCoord || '';
                }

                if (!coord) {
                    coord = 's';
                }

                const vision = calcVision(map, player.pos[0], player.pos[1], coord, MAX_DISTANCE_OBJECTS_DETECT);

                const renderedVision = renderVision(vision, coord, players, loots, _debug);

                // encontrar proximidades
                let textProximities = "";
                let gone = [];
                for (let d = 0; d < MAX_DISTANCE_OBJECTS_DETECT; d++) {
                    for (let i = 0; i < vision[d].length; i++) {
                        const tile = vision[d][i];

                        // se tem cidade
                        if (tile.proxCity) {
                            const city = map[tile.proxCity.origin[0]][tile.proxCity.origin[1]].city;
                            const cityName = city.name;

                            if (!gone.includes('c:' + cityName)) {
                                const distance = calcDistancePos(player.pos, tile.proxCity.origin) - city.radius;
                                const distanceText = getDistanceName(distance);

                                textProximities += `${tileEmojis.city} O local **${cityName}** está há ${distanceText}\n`;

                                gone.push('c:' + cityName);
                            }
                        }

                        // se tem loot
                        let loot = getLootFromTile(tile, loots);
                        if (loot) {
                            console.log('LOOT', loot);
                            const lootName = loot.name;

                            if (!gone.includes('l:' + lootName)) {
                                const distance = calcDistancePos(player.pos, tile.pos);
                                const distanceText = getDistanceName(distance);

                                textProximities += `${tileEmojis.loot} O drop **${lootName}** está há ${distanceText}\n`;

                                gone.push('l:' + lootName);
                            }
                        }

                        // se tem player
                        let playerFound = getPlayerFromTile(tile, players);
                        if (playerFound && playerFound.id !== player.id) {
                            console.log('PLAYER', playerFound);
                            const playerId = playerFound.id;

                            if (!gone.includes('p:' + playerId)) {
                                const distance = calcDistancePos(player.pos, tile.pos);
                                const distanceText = getDistanceName(distance);

                                textProximities += `${tileEmojis.player} Um jogador está há ${distanceText}\n`;

                                gone.push('p:' + playerId);
                            }
                        }
                    }
                }

                // grava a ultima coordenada usada
                player.lastCoord = coord;
                ref.child(`player/${player.id}`).set(player);

                utils.sendLongMessage(responseChannel, `${message.author}, **Visão:**\n${renderedVision}\n**Proximidades:**\n${textProximities || '*Nada muito próximo*'}`);


            }).catch(error => {
                console.error(error);
                message.reply(`:x: ${error}`);
            });
        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        })
    }

    /**
     * Faz o player andar pelo mapa.
     * O player só pode andar pelos tiles que são "andáveis".
     * A sintaxe dos walks é feita de [numero]+[coordenada], em sequencia
     * Exemplo: 10n 3l 4s
     *          (anda 10 para o norte, 3 para leste e 4 para sul)
     *
     * @param message
     * @param args
     */
    static royaleWalkCommand(message, args) {
        if (throwErrorIfNotInRoyaleChannel(message)) return;
        const channel = getRoyaleChannel(message);
        const responseChannel = getResponseChannel(message);
        const helpMsgText = `:x: Digite a quantidade de passos para andar. Por exemplo \`+royale walk 4n 3l\`, você irá andar **7** tiles: **4** pro norte e **3** pro leste.`;

        const _debug = isDebug(message, args);

        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([map, players, loots]) => {
            getPlayer(message.author).then(player => {

                if (!args.length) {
                    message.reply(helpMsgText);
                    return;
                }

                let walks = walkSyntaxToWalks(args.join(" "));

                if (walks.length === 0) {
                    message.reply(helpMsgText);
                    return;
                }

                let availableWalks = getWalksAvailable(player);

                if (availableWalks < walks.length) {
                    const timeLeft = getTimeLeftForNextWalk(player);
                    message.reply(`:x: Você não tem passos suficientes *(tem: ${availableWalks}, precisaria: ${walks.length})*.` + (availableWalks === 0 ? ` Volte em **${timeLeft}** para mais passos.` : ''));
                    return;
                }

                // marca aqui coisas q vc andou por cima, mas nao pegou
                let steppedBy = [];

                // anda
                let newPos = [ player.pos[0], player.pos[1] ];
                let distanceWalked = 0, lastCoord;
                for (let w = 0; w < walks.length; w++) {
                    lastCoord = walks[w];
                    switch (walks[w]) {
                        case 'n':
                            newPos[0]--;
                            break;
                        case 's':
                            newPos[0]++;
                            break;
                        case 'l':
                            newPos[1]++;
                            break;
                        case 'o':
                            newPos[1]--;
                            break;
                    }

                    // a cada passo, checa se não está andando em chão "não pisável"
                    const tile = map[newPos[0]][newPos[1]];
                    if (!tile.walkable) {
                        // se o tile não for andável, já para o andar e não altera nada
                        const terrain = renderTile(tile);
                        message.reply(`:x: Ops! No passo **${w+1}** você encontrou ${terrain} e você não pode passar sobre. Você anda **${distanceWalked}** passos e para de andar.`);

                        // volta um passo
                        switch (walks[w]) {
                            case 'n':
                                newPos[0]++;
                                break;
                            case 's':
                                newPos[0]--;
                                break;
                            case 'l':
                                newPos[1]--;
                                break;
                            case 'o':
                                newPos[1]++;
                                break;
                        }
                        break;

                    }

                    // registra alguns itens pelos quais o player passou
                    // mas não interagiu. isso serve pro player ficar atento aos
                    // drops e outros players por perto
                    if (getPlayerFromTile(tile, players)) {
                        steppedBy.push({
                            type: 'player',
                            emoji: tileEmojis.player,
                            action: 'lutou',
                            pos: tile.pos
                        })
                    } else if (getLootFromTile(tile, loots)) {
                        steppedBy.push({
                            type: 'loot',
                            emoji: tileEmojis.loot,
                            action: 'pegou',
                            pos: tile.pos
                        })
                    }

                    distanceWalked++;
                }

                // se deu certo andar, muda alguns
                // stats e descarta os walks usados
                player.walksUsed += distanceWalked;
                availableWalks -= distanceWalked;
                if (!player.timestampWalks) player.timestampWalks = [];
                for (let w = 0; w < distanceWalked; w++) {
                    player.timestampWalks.push((new Date()).getTime());
                }

                // coloca o player na nova posição
                player.pos = newPos;

                // pega o tile novo no qual o player está atualmente
                const newTile = map[player.pos[0]][player.pos[1]];

                // verifica aqui o que tinha naquele tile, pra fazer algumas
                // interações

                // se tem loot
                let loot = getLootFromTile(newTile, loots);
                let wasLootInteraction = null;
                if (loot) {
                    if (loot.creator === player.id) {
                        // se a pessoa que pisou foi a mesma que criou,
                        // não deixar ela pegar e espalhar o loot de novo
                        const idxLoot = loots.indexOf(loot);

                        loot.pos = getRandomWalkablePos(map, players, loots);
                        loots[idxLoot] = loot;

                        wasLootInteraction = {loot: loot, action: 'CREATOR'};

                    } else if (!isLevelAboveLoot(message, player, loot)) {
                        // se a pessoa não tem level suficiente pra pegar o loot,
                        // não deixar ela pegar e espalhar o loot de novo
                        const idxLoot = loots.indexOf(loot);

                        loot.pos = getRandomWalkablePos(map, players, loots);
                        loots[idxLoot] = loot;

                        wasLootInteraction = {loot: loot, action: 'LEVEL'};

                    } else {
                        player.loot = player.loot || [];

                        // adiciona o loot pro player
                        // TODO: fazer o loot instataneo
                        player.loot.push(loot);

                        // e tira ele da lista de loots no mapa
                        loots.splice(loots.indexOf(loot), 1);

                        wasLootInteraction = {loot: loot, action: 'COLLECTED'};
                    }

                    // salva os loots
                    ref.child(`loot`).set(loots);
                }

                // se tem player
                let playerEnemy = getPlayerFromTile(newTile, players);
                let wasBattleInteraction = null;
                if (playerEnemy && playerEnemy.id !== player.id) {
                    // começa uma luta!
                    const win = (Math.random() * 2000) <= 1000;

                    if (win) {
                        // se ganhou, pega todos os loots do outro player
                        [players, loots, playerEnemy] = respawnPlayer(map, players, loots, playerEnemy, true);
                        player.wins++;
                    } else {
                        // se perdeu, vc morre e respawna
                        [players, loots, player] = respawnPlayer(map, players, loots, player, true);
                        playerEnemy.wins++;
                    }
                    // e salva o player inimigo
                    ref.child(`player/${playerEnemy.id}`).set(playerEnemy);
                    players[playerEnemy.id] = playerEnemy;

                    wasBattleInteraction = {winner: win, enemy: playerEnemy};
                }

                // salva o player
                ref.child(`player/${player.id}`).set(player);
                players[player.id] = player;

                // mostra msg de resposta
                const timeLeft = getTimeLeftForNextWalk(player);
                const distanceWalkedName = getDistanceName(distanceWalked);
                const steppedByText = steppedBy.filter(sb => {
                    // tira todos os stepped by que SÃO o tile q vc ta pisando
                    return sb.pos[0] !== player.pos[0] || sb.pos[1] !== player.pos[1];
                }).map(sb => {
                    return `Você passou por um ${sb.emoji} **${sb.type}**, mas não ${sb.action} há uns ${getDistanceName(calcDistancePos(sb.pos, player.pos))}`;
                }).map(n => `:small_blue_diamond: ${n}`).join("\n");

                let text = `${message.author}, `;
                let textShort = '';

                text += `:white_check_mark: Você andou **${distanceWalkedName}**, `;
                if (availableWalks === 0) {
                    text += `mas não tem mais passos disponíveis. Volte em **${timeLeft}** para mais passos.`;
                } else {
                    text += `e ainda tem ${availableWalks} passos disponíveis.`;
                }
                text += "\n";

                if (steppedByText) {
                    text += `\n**Enquanto andava...**\n${steppedByText}`;
                    text += "\n";
                }

                if (wasBattleInteraction) {
                    text += `\n**Batalha!**\nVocê enfrentou ${tileEmojis.player} <@${wasBattleInteraction.enemy.id}> e...`;
                    // resumo pra anunciar
                    textShort += `\n**Batalha!**\n${tileEmojis.player} <@${player.id}> enfrentou ${tileEmojis.player} <@${wasBattleInteraction.enemy.id}> e...`;

                    if (wasBattleInteraction.winner) {
                        text += `**venceu!** O inimigo teve seu loot espalhado e foi respawnado em algum outro ponto do mapa.`;
                        textShort += `**venceu!** O inimigo teve seu loot espalhado e foi respawnado em algum outro ponto do mapa.`;
                    } else {
                        text += `**perdeu!** Você teve seu loot todo espalhado e foi respawnado(a) em algum outro ponto do mapa.`;
                        textShort += `**perdeu!** Ele(a) teve seu loot todo espalhado e foi respawnado(a) em algum outro ponto do mapa.`;
                    }
                    text += "\n";
                    textShort += "\n";

                }

                if (wasLootInteraction) {
                    text += `\n**Loot!**\n`;
                    // resumo pra anunciar
                    textShort += `\n**Loot!**\n`;

                    switch (wasLootInteraction.action) {
                        case 'CREATOR':
                            text += `Você achou ${tileEmojis.loot} **${wasLootInteraction.loot.name}**, só que lembrou que foi você mesmo(a) que botou lá... então chutou o drop pra longe!`;
                            textShort += `${tileEmojis.player} <@${player.id}> achou  ${tileEmojis.loot} **${wasLootInteraction.loot.name}**, só que lembrou que foi ele(a) mesmo(a) que botou lá... então chutou o drop pra longe!`;
                            break;
                        case 'LEVEL':
                            const minimumLevel = message.guild.roles.get(leveledRoles[wasLootInteraction.loot.levelMin-1]);
                            text += `Você encontrou ${tileEmojis.loot} **${wasLootInteraction.loot.name}**, foi coletar só que... o drop era muito pesado pra você (precisava do level **${minimumLevel.name}**). Com raiva, você chutou o drop pra longe!`;
                            textShort += `${tileEmojis.player} <@${player.id}> encontrou  ${tileEmojis.loot} **${wasLootInteraction.loot.name}**, foi coletar só que... o drop era muito pesado pra ele(a) (precisava do level **${minimumLevel.name}**). Com raiva, ele(a) chutou o drop pra longe!`;
                            break;
                        case 'COLLECTED':
                        default:
                            text += `Você coletou ${tileEmojis.loot} **${wasLootInteraction.loot.name}**!`;
                            textShort += `${tileEmojis.player} <@${player.id}> coletou ${tileEmojis.loot} **${wasLootInteraction.loot.name}**!`;
                    }

                    text += "\n";
                    textShort += "\n";

                }

                const vision = calcVision(map, player.pos[0], player.pos[1], lastCoord, MAX_VISION);
                const renderedVision = renderVision(vision, lastCoord, players, loots, _debug);

                text += `\n**Visão:**\n${renderedVision}`;

                utils.sendLongMessage(responseChannel, text);

                if (responseChannel.id !== channel.id) {
                    // anuncia tbm no canal do jogo
                    utils.sendLongMessage(channel, textShort);
                }

            }).catch(error => {
                console.error(error);
                message.reply(`:x: ${error}`);
            });
        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        })
    }

    /**
     * Gera um novo mapa.
     * Espalha todos os loots e todos os players de novo
     *
     * @param message
     * @param args
     */
    static generateMapCommand(message, args) {
        if (!hasPermission(message)) {
            message.reply(`:x: *Você não tem permissão de gerar um mapa novo.*`);
            return;
        }

        let textLoading = ":map: **Gerando novo mapa...**\n";
        const channel = message.channel;

        channel.send(textLoading + "*Aguarde...*").then(msgLoading => {

            let seed = args[0] || 78;

            textLoading += "Criando mesh do mapa...\n";
            msgLoading.edit(textLoading);

            let map = new Map(
                (new MeshBuilder({boundarySpacing: 75})).addPoisson(Poisson, 50).create(),
                {amplitude: 0.2, length: 4, seed: seed},
                makeRandomInt
            );

            textLoading += "Calculando biomas...\n";
            msgLoading.edit(textLoading);

            let noise = new SimplexNoise(seed);
            map.calculate({
                noise: noise,
                drainageSeed: 0, // variant
                riverSeed: 0, // variant
                biomeBias: {
                    north_temperature: 0.5, // pra gerar menos gelo
                    south_temperature: 0.5, // pra gerar menos gelo
                    moisture: 0
                }
            });

            function region_bondaries(mesh, r) {
                let rx = mesh.r_x(r), ry = mesh.r_y(r);
                let upper_x = Infinity,
                    upper_y = Infinity,
                    bottom_x = -Infinity,
                    bottom_y = -Infinity;
                let out_t = [];
                mesh.r_circulate_t(out_t, r);
                for (let t of out_t) {
                    let tx = mesh.t_x(t), ty = mesh.t_y(t);

                    if (tx < upper_x) {
                        upper_x = tx;
                    }
                    if (tx > bottom_x) {
                        bottom_x = tx;
                    }
                    if (ty < upper_y) {
                        upper_y = ty;
                    }
                    if (ty > bottom_y) {
                        bottom_y = ty;
                    }
                }
                return {
                    min: [upper_x, upper_y],
                    max: [bottom_x, bottom_y],
                    value: [rx, ry]
                };
            }

            textLoading += "Identificando os polígonos...\n";
            msgLoading.edit(textLoading);

            let polygons = [];
            for (let r = 0; r < map.mesh.numSolidRegions; r++) {
                polygons.push({
                    tile: {
                        biome: map.r_biome[r],
                        walkable: !(map.r_water[r] || map.r_ocean[r])
                    },
                    prop: region_bondaries(map.mesh, r)
                });
                // polygons.push(map.mesh.r_circulate_t([], r)
                //     .map((t) => map.mesh.t_pos([], t)));
            }

            //console.log(polygons);

            textLoading += "Encontrando os boundaries dos polígonos...\n";
            msgLoading.edit(textLoading);

            //pointsInPolygon(polygons, (x, y) => console.log(x, y));

            let arrayMap = [];

            // colocando os biomas nos tiles
            for (let x = 0; x < MAP_HEIGHT; x++) {
                arrayMap[x] = [];
                for (let y = 0; y < MAP_WIDTH; y++) {
                    let found = false;
                    let xCenter = (x * (1000 / MAP_HEIGHT)) + ((1000 / MAP_HEIGHT) / 2),
                        yCenter = (y * (1000 / MAP_WIDTH)) + ((1000 / MAP_WIDTH) / 2);
                    for (let i = 0; i < polygons.length; i++) {
                        if (polygons[i].prop.min[0] <= xCenter && polygons[i].prop.max[0] >= xCenter
                            && polygons[i].prop.min[1] <= yCenter && polygons[i].prop.max[1] >= yCenter) {
                            arrayMap[x][y] = Object.assign({}, polygons[i].tile);
                            arrayMap[x][y].pos = [x, y];
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        arrayMap[x][y] = Object.assign({}, polygons[0].tile);
                        arrayMap[x][y].pos = [x, y];
                    }
                }
            }

            textLoading += "Distribuindo as cidades...\n";
            msgLoading.edit(textLoading);

            // distribuindo as cidades nos tiles
            for (let c = 0; c < cities.length; c++) {
                const city = cities[c];

                // se o bioma exigido for qq um, colocar em qq tile aleatorio,
                // menos no oceano
                let testBiome = null;
                if (city.biomes === true) {
                    testBiome = function (city, biome) {
                        return biome !== 'OCEAN';
                    };

                } else if (city.biomes.length) {
                    testBiome = function (city, biome) {
                        return city.biomes.includes(biome);
                    };
                }

                if (testBiome !== null) {
                    let tries = 500;
                    while (tries--) {
                        let xa = parseInt(Math.random() * MAP_HEIGHT),
                            ya = parseInt(Math.random() * MAP_WIDTH);

                        if (testBiome(city, arrayMap[xa][ya].biome)) {
                            arrayMap[xa][ya].city = city;
                            console.log('CITY' + city.name + ' IN ', xa, ya);

                            // coloca os pontos adjacentes
                            const startx = Math.max(xa - city.radius, 0),
                                endx = Math.min(xa + city.radius, MAP_HEIGHT),
                                starty = Math.max(ya - city.radius, 0),
                                endy = Math.min(ya + city.radius, MAP_WIDTH);

                            for (let x = startx; x < endx; x++) {
                                for (let y = starty; y < endy; y++) {
                                    arrayMap[x][y].proxCity = {
                                        origin: [xa, ya]
                                    }
                                }
                            }

                            break;
                        }
                    }
                }
            }

            textLoading += "Salvando no db...\n";
            msgLoading.edit(textLoading);

            saveMap(arrayMap).then(map => {
                // verifica se tem loots no mapa, pra poder reespalhar
                return Promise.all([
                    getLoots(),
                    getPlayers()
                ]).then(([loots, players]) => {
                    // se tiver loots no mapa, respalhar eles
                    if (loots.length) {
                        textLoading += "Espalhando os loots atuais...\n";
                        msgLoading.edit(textLoading);

                        const lootRef = ref.child(`loot`);

                        for (let i = 0; i < loots.length; i++) {
                            loots[i].pos = getRandomWalkablePos(map);
                            // aqui não passo os players e loots pq tecnicamente eu
                            // quero q o loot possa ficar no tile que quiser,
                            // mesmo q tenha player, pq eu vou espalhar eles
                            // logo em seguida
                        }

                        // salva o novo array de loots
                        lootRef.set(loots);

                        console.log('LOOTS REESPALHADOS COM SUCESSO');
                    }

                    // se tiver players no mapa, respalhar tbm
                    if (players) {
                        textLoading += "Espalhando os players atuais...\n";
                        msgLoading.edit(textLoading);

                        const playerRef = ref.child(`player`);

                        for (let p in players) {
                            players[p].pos = getRandomWalkablePos(map, players, loots);
                            // aqui eu passo pq agora já tem loot na tela
                        }

                        // salva o novo array de loots
                        playerRef.set(players);

                        console.log('PLAYERS REESPALHADOS COM SUCESSO');
                    }

                    textLoading += "*Pronto!*\n\nPra visualizar, use `+royale view-map`";
                    msgLoading.edit(textLoading);
                });

            }).catch(error => {
                console.error(error);
                message.reply(`:x: ${error}`);
            });

        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        });

    }

    /**
     * Mostra o mapa total.
     *
     * @param message
     * @param args
     */
    static viewMapCommand(message, args) {
        if (!hasPermission(message)) {
            message.reply(`:x: *Você não tem permissão de usar esse comando.*`);
            return;
        }
        //if (throwErrorIfNotInRoyaleChannel(message)) return;
        //const channel = getRoyaleChannel(message);
        const channel = message.channel;

        const _debug = isDebug(message, args);

        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([map, players, loots]) => {
            const hasPerm = hasPermission(message);

            const quadrant = args.filter(a => {
                return a.substr(0, 6) === '--quad';
            }).map(a => a.substr(7))[0];

            let text = ":map: **Mapa** (escala 1/2)";
            if (quadrant !== undefined) {
                text += " - (quadrante " + (parseInt(quadrant) + 1) + ")";
            }
            text += "\nCada *1 tile real* equivale a *100m*\n";

            text += renderMap(
                map,
                hasPerm && args.includes('--show-players') ? players : null,
                hasPerm && args.includes('--show-loots') ? loots : null,
                !args.includes('--no-city'),
                quadrant,
                _debug
            );

            utils.sendLongMessage(channel, text);

            // channel.send(":map: **Mapa**\n*Aguarde, carregando...*")
            //     .then(msgTitle => {
            //         function _sendMapPiece() {
            //             const mapText = texts.shift();
            //             return channel.send(mapText)
            //                 .then(() => {
            //                     if (texts.length) {
            //                         // continua enquanto tiver emoji pra mandar
            //                         return _sendMapPiece();
            //                     }
            //                     // acabou os emojis
            //                     return true;
            //                 }).catch(console.error);
            //         }
            //
            //         _sendMapPiece().then(() => {
            //             console.log('RENDERIZOU O MAPA');
            //             let text = ":map: **Mapa** (escala 1/2)";
            //             if (quadrant !== undefined) {
            //                 text += " - (quadrante " + (parseInt(quadrant) + 1) + ")";
            //             }
            //             text += "\nCada *1 tile real* equivale a *100m*";
            //             msgTitle.edit(text);
            //         })
            //     });

        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        });
    }

    /**
     * Dropa um loot que nós admins quisermos
     *
     * @param message
     * @param args
     */
    static dropLootCommand(message, args) {
        if (!hasPermission(message)) {
            message.reply(`:x: *Você não tem permissão de dropar um loot.*`);
            return;
        }

        const lootName = args.shift();
        const lootLevelMin = parseInt(args.shift()) || 0;

        if (!lootName) {
            message.reply(`:x: Nome do drop obrigatório. Use \`+royale drop "nome do loot" [level minimo do drop]\``);
            return;
        }

        if (lootLevelMin > leveledRoles.length) {
            message.reply(`:x: O level mínimo do drop deve ser um número de 1 até ${leveledRoles.length}. Use \`+royale drop "nome do loot" [level minimo do drop]\``);
            return;
        }

        const channel = getRoyaleChannel(message);
        const responseChannel = getResponseChannel(message);

        // vai pegar as sintaxes:
        // x y
        // x,y
        // x, y
        let forcedPos = hasPermission(message) ? args.join(',').split(/,+/).slice(0, 2).map(f => parseInt(f)) : null;
        if (!forcedPos[0]) {
            forcedPos = null;
        }
        console.log("FORCED POS", forcedPos);

        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([map, players, loots]) => {
            const pos = getRandomWalkablePos(map, players, loots, forcedPos);

            loots.push({
                id: String((new Date()).getTime()).substr(4, 6),
                name: lootName,
                pos: pos,
                creator: message.author.id,
                levelMin: lootLevelMin,
                ts: (new Date()).getTime()
            });

            // salva o novo array de loots
            ref.child(`loot`).set(loots, function (error) {
                if (error) {
                    throw error;
                }

                channel.send(`${tileEmojis.loot} **Atenção!** Um drop caiu na ilha! O loot é **${lootName}**!`);
            });


        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        });
    }

    /**
     * Dropa um loot que nós admins quisermos
     *
     * @param message
     * @param args
     */
    static removeDropLootCommand(message, args) {
        if (!hasPermission(message)) {
            message.reply(`:x: *Você não tem permissão para esse comando.*`);
            return;
        }

        const lootId = args.shift();

        if (!lootId) {
            message.reply(`:x: Id do drop obrigatório. Use \`+royale remove-drop id\``);
            return;
        }

        const channel = getRoyaleChannel(message);
        const responseChannel = getResponseChannel(message);

        Promise.all([
            getPlayers(),
            getLoots()
        ]).then(([players, loots]) => {

            const successCallback = function (error) {
                if (error) {
                    throw error;
                }

                channel.send(`:white_check_mark: Drop **${foundLoot.name}** foi removido com sucesso.`);
            };

            let foundLoot = loots.filter(l => {
                return (l.id === lootId || l.name === lootId);
            });

            if (!foundLoot.length) {
                // se não encontrou, tenta ver se esse loot ta na mão de alguem
                let foundPlayer;
                for (var p in players) {
                    foundLoot = players[p].loot.filter(l => {
                        return (l.id === lootId || l.name === lootId);
                    });

                    if (foundLoot.length) {
                        // se encontrou, já para
                        foundPlayer = players[p];
                        break;
                    }
                }

                if (!foundLoot.length) {
                    // se mesmo assim não encontrou, dar erro
                    message.reply(`:x: Drop com id **${lootId}** não encontrado.`);
                    return;
                }

                // se encontrou no player, tira da lista dele
                foundLoot = foundLoot[0];
                foundPlayer.loot.splice(foundPlayer.loot.indexOf(foundLoot), 1);

                // salva o novo array de loots
                ref.child(`player/${foundPlayer.id}`).set(foundPlayer, successCallback);
                return;
            }

            // se encontrou, tira esse loot da lista
            foundLoot = foundLoot[0];
            loots.splice(loots.indexOf(foundLoot), 1);

            // salva o novo array de loots
            ref.child(`loot`).set(loots, successCallback);


        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        });
    }

    /**
     * Lista os loots do mapa
     *
     * @param message
     * @param args
     */
    static lootListCommand(message, args) {
        if (throwErrorIfNotInRoyaleChannel(message)) return;
        const channel = getRoyaleChannel(message);
        const responseChannel = getResponseChannel(message);

        const showIds = hasPermission(message) ? args.includes('--id') : null;
        const showLevels = hasPermission(message) ? args.includes('--level') : null;

        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([map, players, loots]) => {

            let orderedLoots = [];

            // se tem loots na ilha, listar
            if (loots.length) {
                for (let l = 0; l < loots.length; l++) {
                    orderedLoots.push({
                        id: loots[l].id,
                        name: loots[l].name,
                        pos: loots[l].pos,
                        levelMin: loots[l].levelMin,
                        ownedBy: null,
                        closestCity: null //findClosestCity(map, loots[l].pos)
                    });
                }
            }

            // se tem players, ver os loots deles
            if (players) {
                for (let p in players) {
                    if (players[p].loot) {
                        const pLoots = players[p].loot;
                        for (let l = 0; l < pLoots.length; l++) {
                            orderedLoots.push({
                                id: pLoots[l].id,
                                name: pLoots[l].name,
                                pos: pLoots[l].pos,
                                levelMin: pLoots[l].levelMin,
                                ownedBy: players[p].id,
                                closestCity: null //findClosestCity(map, pLoots[l].pos)
                            });
                        }
                    }
                }
            }

            if (orderedLoots.length) {
                orderedLoots.sort(function (a, b) {
                    const nameA = a.name.toUpperCase(); // ignore upper and lowercase
                    const nameB = b.name.toUpperCase(); // ignore upper and lowercase
                    if (nameA < nameB) {
                        return -1;
                    }
                    if (nameA > nameB) {
                        return 1;
                    }

                    // names must be equal
                    return 0;
                });

                const lootText = orderedLoots.map(l => {
                    return `**${l.name}**`
                        + (l.ownedBy
                            ? ` (com: ${tileEmojis.player} <@${l.ownedBy}>)`
                            : (l.closestCity
                                ? ` (local mais próximo: ${tileEmojis.city} *${l.closestCity}*)`
                                : ''
                            )
                        )
                        + (showIds
                            ? ` *[id: ${l.id}]*`
                            : ''
                        )
                        + (showLevels
                                ? ` *[level min: ${l.levelMin}]*`
                                : ''
                        )
                        ;
                }).map(n => `:small_blue_diamond: ${n}`).join("\n");

                responseChannel.send(`${message.member}, ${tileEmojis.loot} **Lista de drops**\n${lootText}`);

            } else {
                responseChannel.send(`${message.member}, ${tileEmojis.loot} **Lista de drops**\n*Nenhum drop no momento. Aguarde os admins droparem itens!*`);
            }

        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        });
    }

    /**
     * Lista os players do mapa
     *
     * @param message
     * @param args
     */
    static playersListCommand(message, args) {
        if (throwErrorIfNotInRoyaleChannel(message)) return;
        const channel = getRoyaleChannel(message);
        const responseChannel = getResponseChannel(message);

        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([map, players, loots]) => {

            let orderedPlayers = [];

            // se tem players, ver os loots deles
            if (players) {
                for (let p in players) {
                    orderedPlayers.push({
                        id: players[p].id,
                        pos: players[p].pos,
                        info: players[p],
                        closestCity: null //findClosestCity(map, players[p].pos)
                    });
                }
            }

            orderedPlayers.sort(function (a, b) {
                const nameA = a.id.toUpperCase(); // ignore upper and lowercase
                const nameB = b.id.toUpperCase(); // ignore upper and lowercase
                if (nameA < nameB) {
                    return -1;
                }
                if (nameA > nameB) {
                    return 1;
                }

                // names must be equal
                return 0;
            });

            const playerText = orderedPlayers.map(l => {
                return `<@${l.id}>` + (l.closestCity ? ` (local mais próximo: ${tileEmojis.city} *${l.closestCity}*)` : ``);
            }).map(n => `:small_blue_diamond: ${n}`).join("\n");

            responseChannel.send(`${message.member}, ${tileEmojis.player} **Lista de players jogando**\n${playerText}`);

        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        });
    }

    /**
     * Quando um membro sair do server
     *
     * @param member
     */
    static onGuildMemberRemove(member) {
        const user = member.user;

        exitPlayer(user).then(successMsg => {
            const channel = getRoyaleChannel(message);
            channel.send(successMsg);
        }).catch(error => {
            //message.reply(`:x: ${error}`);
            // ignora o erro, só loga ele pra saber. se o usuario saiu e não tava participando,
            // não tem pq dar erro
            console.error(error);
        })
    }

    static commands() {
        return {
            'royale': BattleRoyale.royaleCommand,
        }
    }

    static events() {
        return {
            'guildMemberRemove': BattleRoyale.onGuildMemberRemove
        }
    }
}

function getRoyaleChannel(message) {
    const guild = message.guild || message.client.guilds.get('213797930937745409');
    if (guild) {
        const ch = guild.channels.get(ROYALE_CHANNEL_ID);
        if (!ch) {
            throw new Error("Channel do Battle Royale não encontrado. Alguém deletou.");
        }
        return ch;
    }

    throw new Error("Não foi possível encontrar o Café com Pão. Algo deu muito errado...");
}

function getResponseChannel(message) {
    return message.channel;
}

function throwErrorIfNotInRoyaleChannel(message) {
    if (!(message.channel instanceof Discord.DMChannel) && message.channel.id !== ROYALE_CHANNEL_ID) {
        message.reply(`:x: Só é permitido jogar o *Battle Royale* no canal <#${ROYALE_CHANNEL_ID}> ou via DM.`)
            .then(m => {
                // deleta a sua mensagem de comando
                message.delete();
                // deleta a mensagem de aviso dps de 4 segundos
                m.delete(4000);
            });
        return true;
    }

    return false;
}

/**
 * Retorna a letra daquele bioma
 */
function renderTile(tile, players, loots, _debug) {
    const tileSeed = tile.pos[0] + tile.pos[1];
    let tileText;
    //return `[BIOME: ${tile.biome}, X: ${tile.pos[0]}, Y: ${tile.pos[1]}]`;
    let p = players ? getPlayerFromTile(tile, players) : null,
        l = loots ? getLootFromTile(tile, loots): null;
    if (p) {
        tileText = tileEmojis.player;
    }
    else if (l) {
        tileText = tileEmojis.loot;
    }
    else if (tile.biome === 'OCEAN') tileText = tileEmojis.oceano; //return '▓';
    else if (tile.biome === 'BEACH') tileText = tileEmojis.areia; //return '░';
    else if (tile.biome === 'TEMPERATE_RAIN_FOREST'
        || tile.biome === 'TEMPERATE_DECIDUOUS_FOREST'
        || tile.biome === 'TROPICAL_RAIN_FOREST'
        || tile.biome === 'TROPICAL_SEASONAL_FOREST') tileText = utils.seededRandom(tileSeed) < 0.1 ? tileEmojis.arvore : tileEmojis.arvore2; //'▓';
    else if (tile.biome === 'LAKE'
        || tile.biome === 'MARSH'
        || tile.biome === 'ICE') tileText = tileEmojis.rio;
    else if (tile.biome === 'TEMPERATE_DESERT'
        || tile.biome === 'SUBTROPICAL_DESERT'
        || tile.biome === 'SHRUBLAND') tileText = tileEmojis.deserto; //return '▒';
    else if (tile.biome === 'GRASSLAND'
        || tile.biome === 'TAIGA') tileText = tileEmojis.grama; //return '▒';
    else {
        tileText = tileEmojis.empty;
    }

    if (_debug && (p || l)) {
        tileText = `${tileText} (${p.pos[0]},${p.pos[1]})`;
    }

    return tileText;
}

function getPlayer(user) {
    return new Promise((resolve, reject) => {
        const playerRef = ref.child(`player/${user.id}`);

        playerRef.once('value', snapshot => {
            let player = snapshot.val();

            if (!player) {
                reject('Usuário não está jogando. Use `+royale enter` pra participar.');
            } else {
                player.timestampWalks = player.timestampWalks || [];
                player.timestampTeleports = player.timestampTeleports || [];
                player.loot = player.loot || [];
                resolve(player);
            }
        });
    });
}

function createPlayer(user, forcedPos) {
    return new Promise((resolve, reject) => {
        Promise.all([
            getMap(),
            getPlayers()
        ]).then(([ map, players ]) => {
            const playerRef = ref.child(`player/${user.id}`);

            playerRef.once('value', snapshot => {
                let info = snapshot.val();

                if (!info) {
                    const randomPos = getRandomWalkablePos(map, players, null, forcedPos);

                    info = {
                        id: user.id,
                        deaths: 0,
                        wins: 0,
                        loot: [],
                        timestampWalks: [],
                        timestampTeleports: [],
                        walksUsed: 0,
                        pos: randomPos
                    };

                    // salva o que foi definido
                    playerRef.set(info);

                    resolve([false, info]);
                } else {
                    resolve([true, info]);
                }

            });
        }).catch(reject);
    });
}

function respawnPlayer(map, players, loots, userOrPlayer, inBattle, forcedPos) {
    const randomPos = getRandomWalkablePos(map, players, loots, forcedPos);
    const player = players[userOrPlayer.id];

    // seta novo tile pro player
    player.pos = randomPos;
    // aumenta uma morte
    player.deaths++;

    let droppedLoots = [];
    if (player.loot && player.loot.length) {
        let lostLoots = [];

        if (inBattle) {
            // se foi em batalha, perde todos os loots
            lostLoots = player.loot;
            player.loot = [];
        } else {
            // se nao foi em batalha, perde só um loot aleatorio
            let playerLoots = utils.shuffle(player.loot);
            lostLoots.push(playerLoots.shift());
            player.loot = playerLoots;
        }

        for (let i = 0; i < lostLoots.length; i++) {
            const loot = lostLoots[i],
                  randomPos = getRandomWalkablePos(map, players, loots);

            loots.push({
                id: loot.id,
                name: loot.name,
                pos: randomPos,
                creator: loot.creator,
                levelMin: loot.levelMin,
                ts: (new Date()).getTime()
            });

            droppedLoots.push(loot.name);
        }

        // salva infos do loot
        ref.child(`loot`).set(loots);
    }
    // retorna o player
    return [ players, loots, player ];
}

function exitPlayer(user) {
    return new Promise((resolve, reject) => {
        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([ map, players, loots ]) => {
            const player = players[user.id];

            // se tiver loot, espalhar eles no mapa
            if (player.loot && player.loot.length) {

                let droppedLoots = [];

                for (let i = 0; i < player.loot.length; i++) {
                    const loot = player.loot[i],
                          randomPos = getRandomWalkablePos(map, players, loots);

                    loots.push({
                        id: loot.id,
                        name: loot.name,
                        pos: randomPos,
                        creator: loot.creator,
                        levelMin: loot.levelMin,
                        ts: (new Date()).getTime()
                    });

                    droppedLoots.push(loot.name);
                }

                // salva o novo array de loots
                ref.child(`loot`).set(loots);

                // deleta o usuario da lista
                ref.child(`player/${user.id}`).set(null);
                delete players[user.id];

                resolve(`:outbox_tray: Usuário ${user} saiu do jogo e deixou os loots espalhados: **${droppedLoots.join('**, **')}**`);
            } else {
                // não tem loot pra espalhar, entao simplesmente deleta o usuario
                ref.child(`player/${user.id}`).set(null);
                delete players[user.id];

                resolve(`:outbox_tray: Usuário ${user} saiu do jogo!`);
            }

        }).catch(reject);
    });
}

function getPlayers() {
    return new Promise((resolve, reject) => {
        const playerRef = ref.child(`player`);

        playerRef.once('value', snapshot => {
            let players = snapshot.val();

            if (!players) {
                resolve({});
            } else {
                for (var p in players) {
                    players[p].timestampWalks = players[p].timestampWalks || [];
                    players[p].timestampTeleports = players[p].timestampTeleports || [];
                    players[p].loot = players[p].loot || [];
                }
                resolve(players);
            }
        });
    });
}

function getLoots() {
    return new Promise((resolve, reject) => {
        const lootRef = ref.child(`loot`);

        lootRef.once('value', snapshot => {
            let loots = snapshot.val();

            if (!loots) {
                resolve([]);
            } else {
                resolve(loots);
            }
        });
    });
}

// TODO: mudar o nome pra Pos em vez de Tile, pois Tile tem outra conotação agora
// TODO: transformar essa funcao em algo sem promise, em que receba todos os params necessarios
// exemplo: function grwt(forcePos, map, players, loots, tries) { ...
function getRandomWalkablePos(map, players, loots, forcePos, tries) {
    tries = tries || 200;

    if (forcePos) {
        let xa = forcePos[0],
            ya = forcePos[1];

        if (map[xa][ya].walkable && !getPlayerFromTile({ pos: [xa, ya] }, players)) {
            return forcePos;
        } else {
            throw new Error('Não pode ser colocado neste tile.');
        }
    }

    while (tries--) {
        let xa = parseInt(Math.random() * MAP_HEIGHT),
            ya = parseInt(Math.random() * MAP_WIDTH);

        if (map[xa][ya].walkable && !getPlayerFromTile({ pos: [xa, ya] }, players)) {
            return [xa, ya];
        }
    }

    throw new Error('Houve um erro inesperado e não foi possível detectar um tile no momento. Tente novamente.');
}

function getMap() {
    return new Promise((resolve, reject) => {
        const mapRef = ref.child(`map`);

        mapRef.once('value', snapshot => {
            let map = snapshot.val();

            if (!map) {
                reject('Mapa ainda não foi gerado. Aguarde os administradores gerarem um mapa para o jogo.');
            } else {
                resolve(map);
            }
        });
    });
}

function saveMap(map) {
    return new Promise((resolve, reject) => {
        return ref.child(`map`).set(map, function (error) {
            if (error) {
                reject(error);
            } else {
                resolve(map);
            }
        });
    });
}

function calcDistance(xorig, yorig, xdest, ydest) {
    const dx = xorig - xdest,
        dy = yorig - ydest;
    const hipotenuse = dx*dx + dy*dy;
    return Math.abs(Math.sqrt(hipotenuse));
}

function calcDistancePos(posOrig, posDest) {
    return calcDistance(posOrig[0], posOrig[1], posDest[0], posDest[1]);
}

function getDistanceName(distance) {
    let value = parseInt(Math.round(distance * 100));
    return value + ' metro' + (value !== 1 ? 's' : '');

    // const distances = [
    //     { value: 0, name: 'aqui' },
    //     { value: 1, name: 'muito perto' },
    //     { value: 2, name: 'bem perto' },
    //     { value: 4, name: 'perto' },
    //     { value: 6, name: 'pouco longe' },
    //     { value: 10, name: 'bem longe' },
    //     { value: Infinity, name: 'muito longe' },
    // ];
    // let distanceName = distances[0].name;
    // for (let i = 0; i < distances.length; i++) {
    //     if (distance >= distances[i].value) {
    //         distanceName = distances[i].name;
    //     }
    // }
    // return distanceName;
}

function calcVision(map, x, y, coord, distanceVision) {
    let vision = [];

    const orientation = ['n', 's'].includes(coord) ? 'v' : 'h';
    const direction = ['n', 'o'].includes(coord) ? -1 : 1;

    let origBounds = [x, x, y, y];
    for (let i = 0; i < distanceVision; i++) {
        vision[i] = [];

        // limitar os bounds pelos edges do mapa
        origBounds[0] = Math.max(Math.min(origBounds[0], MAP_HEIGHT - 1), 0);
        origBounds[1] = Math.max(Math.min(origBounds[1], MAP_HEIGHT - 1), 0);
        origBounds[2] = Math.max(Math.min(origBounds[2], MAP_WIDTH - 1), 0);
        origBounds[3] = Math.max(Math.min(origBounds[3], MAP_WIDTH - 1), 0);

        console.log('BOUNDS', origBounds);

        if (orientation === 'h') {
            let yo = origBounds[2];
            for (let xo = origBounds[0]; xo <= origBounds[1]; xo++) {
                vision[i].push(map[xo][yo]);
            }
            origBounds[2] += direction;
            origBounds[0] -= 1;
            origBounds[1] += 1;
        } else {
            let xo = origBounds[1];
            for (let yo = origBounds[2]; yo <= origBounds[3]; yo++) {
                vision[i].push(map[xo][yo]);
            }
            origBounds[1] += direction;
            origBounds[2] -= 1;
            origBounds[3] += 1;
        }
    }

    return vision;

}

function renderVision(vision, coord, players, loots, _debug) {
    const orientation = ['n', 's'].includes(coord) ? 'v' : 'h';
    const inverted = ['n', 'o'].includes(coord);
    let visionCopy = vision.slice(0, MAX_VISION);

    if (inverted) {
        visionCopy = visionCopy.reverse();
    }

    let rendered = "";
    if (orientation === 'v') {
        for (let v = 0; v < MAX_VISION; v++) {
            const x = visionCopy[v];
            if (!x) {
                break;
            }
            const row = x.map(y => renderTile(y, players, loots, _debug)).join('');
            const blanks = (1 + (2 * (MAX_VISION - 1))) - x.length;
            if (blanks < 0) continue; // segurança
            const midBlank = parseInt(blanks / 2);

            rendered += (`${tileEmojis.empty}`.repeat(midBlank)) + row;
            rendered += "\n";
        }
    } else {
        let lines = [];
        const lineCount = (1 + (2 * (MAX_VISION - 1)));

        for (let v = 0; v < MAX_VISION; v++) {
            const x = visionCopy[v];
            if (!x) {
                break;
            }
            const row = x.map(y => renderTile(y, players, loots, _debug));
            const blanks = (1 + (2 * (MAX_VISION - 1))) - x.length;
            if (blanks < 0) continue; // segurança
            let midBlank = parseInt(blanks / 2);

            while (row.length) {
                if (!lines[midBlank]) { lines[midBlank] = []; }
                lines[midBlank].push(row.shift());
                midBlank++;
            }
        }

        // inserir os blanks qdo for pro lado direito
        if (!inverted) {
            for (let l = 0; l < lines.length; l++) {
                const blanksText = (`${tileEmojis.empty}`.repeat(MAX_VISION - lines[l].length));
                lines[l].unshift(blanksText);
            }
        }

        rendered += lines.map(l => l.join('')).join("\n");
    }

    return rendered;
}

function getLootFromTile(tile, loots) {
    let loot = loots.filter(l => l.pos[0] === tile.pos[0] && l.pos[1] === tile.pos[1]);
    if (loot.length) {
        return loot[0];
    }
    return null;
}

function getPlayerFromTile(tile, players) {
    if (players) {
        for (let p in players) {
            if (players[p].pos[0] === tile.pos[0] && players[p].pos[1] === tile.pos[1]) {
                players[p].id = p; // FIXME: precisa sempre colocar o id de novo?
                return players[p];
            }
        }
    }
    return null;
}

function renderMap(map, players, loots, showCities, detailsQuadrant, _debug) {
    // primeiro eu tento diminuir uma escada do mapa, pra ele ficar pela metade
    function compareTiles(tile1, tile2) {
        if ((players && getPlayerFromTile(tile2, players)) || (loots && getLootFromTile(tile2, loots))) {
            return tile2;
        } else if ((tile2.walkable && !tile1.walkable) || tile2.city) {
            return tile2;
        } else if (tile2.biome !== 'BEACH' && tile2.biome !== 'OCEAN' && !tile1.city) {
            return tile2;
        }

        return tile1;
    }

    let newMap = [];
    if (detailsQuadrant) {
        if (detailsQuadrant > 3) {
            throw new Error('Número de quadrante não suportado. Somente de 0 até 3.');
        }
        let quadrant = [ Math.floor(detailsQuadrant / 2), detailsQuadrant % 2 ];
        quadrant[0] *= MAP_HEIGHT / 2;
        quadrant[1] *= MAP_WIDTH / 2;
        for (let x = quadrant[0]; x < quadrant[0] + MAP_HEIGHT / 2; x++) {
            newMap[x - quadrant[0]] = [];
            for (let y = quadrant[1]; y < quadrant[1] + MAP_WIDTH / 2; y++) {
                newMap[x - quadrant[0]][y - quadrant[1]] = map[x][y];
            }
        }
    } else {
        for (let x = 0; x < map.length; x+=2) {
            newMap[x/2] = [];
            for (let y = 0; y < map[x].length; y+=2) {
                newMap[x/2][y/2] = compareTiles(compareTiles(map[x][y], map[x][y+1]), compareTiles(map[x+1][y], map[x+1][y+1]));
            }
        }
    }

    let textMap = "";
    let obs = [], obsIdx = 1;
    newMap.map(ax => {
        let y = 0;
        let textRow = [];
        while (y < ax.length) {
            const tile = ax[y];

            textRow.push(renderTile(tile, players, loots, _debug));

            if (showCities && tile.city) {
                // tira o ultimo inserido
                textRow.pop();

                // insere um numero no lugar
                textRow.push('`[' + obsIdx + ']`');
                obs.push('`[' + obsIdx + ']` **' + tile.city.name + '** (área: ' + getDistanceName(tile.city.radius * 2) + '²)');
                obsIdx++;
            }

            y++;
        }
        textRow = textRow.join("");

        textMap += textRow + ".\n";
    });

    if (obs.length) {
        textMap += obs.join("\n");
    }

    return textMap;
}

// transforma a sintaxe 2s 1l 3n em ['s', 's', 'l', 'n', 'n', 'n']
function walkSyntaxToWalks(syntax) {
    // limito pra evitar o exploit de varias direções, ex: 1n 1l 1s 1l 1n 1l 1n 1s ...
    const parts = syntax.split(/\s+/).slice(0, MAX_WALKS + 1);
    let walks = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        let steps, coord;
        // tenta a sintaxe basica: n n l l s s
        if (part.match(/^[a-z]$/)) {
            steps = 1;
            coord = part;
        } else {
            // tenta a sintaxe padrão: 1n
            let matchs = part.match(/^(\d+)([a-z]+)$/);
            if (!matchs) {
                // tenta o modo ao contrario: n1
                matchs = part.match(/^([a-z]+)(\d+)$/);

                if (!matchs) {
                    // se ainda assim nao der, desiste
                    break;
                } else {
                    [, coord, steps] = matchs;
                }
            } else {
                [, steps, coord] = matchs;
            }
        }
        if (steps && coord) {
            // limito os steps, pra evitar o exploit de uma direção, ex: 99999n
            steps = Math.min(Math.max(0, steps), MAX_WALKS + 1);
            coord = normalizeCoord(coord);
            while (coord && steps--) {
                // adiciona no array quantas vezes tiver step
                walks.push(coord);
            }
        }
    }

    // no fim, ainda limito o resultado tbm, pq pode ter o exploit de fazer 999n 999l 999s ...
    walks = walks.slice(0, MAX_WALKS + 1);

    console.log('WALKS CALCULATED', walks);

    return walks;
}

function getWalksAvailable(player) {
    let walksAvailable = 0;
    for (let i = 0; i < MAX_WALKS; i++) {
        const time = (player.timestampWalks || [])[i];

        // se nao tem horario, entao ele tem slot
        if (!time) {
            walksAvailable++;
        }
        // se o horario que foi feito o walk + x minutos foi
        // antes do horario atual, entao ele tem walk
        else if (time + (DELAY_WALKS * 60000) < (new Date()).getTime()) {
            walksAvailable++;
        }
    }

    return walksAvailable;
}

function getTimeLeftForNextWalk(player) {
    const oldestTimestampWalk = player.timestampWalks.slice().sort();
    let diffSeconds = (DELAY_WALKS * 60) - ((new Date()).getTime() - oldestTimestampWalk[0]) / 1000;

    return formatTime(diffSeconds);
}

function getTeleportsAvailable(player) {
    let tpsAvailable = 0;
    for (let i = 0; i < MAX_TELEPORTS; i++) {
        const time = (player.timestampTeleports || [])[i];

        // se nao tem horario, entao ele tem slot
        if (!time) {
            tpsAvailable++;
        }
        // se o horario que foi feito o walk + x minutos foi
        // antes do horario atual, entao ele tem walk
        else if (time + (DELAY_TELEPORTS * 60000) < (new Date()).getTime()) {
            tpsAvailable++;
        }
    }

    return tpsAvailable;
}

function getTimeLeftForNextTeleport(player) {
    const oldestTimestampTp = player.timestampTeleports.slice().sort();
    let diffSeconds = (DELAY_TELEPORTS * 60) - ((new Date()).getTime() - oldestTimestampTp[0]) / 1000;

    return formatTime(diffSeconds);
}

function formatTime(seconds) {
    if (seconds > 3600) {
        const minutes = parseInt((seconds % 3600) / 60);
        const minutesText = minutes > 0 ? ` e ${minutes} minuto(s)` : '';
        return parseInt(seconds / 3600) + ' hora(s)' + minutesText;
    }

    if (seconds > 60) {
        return parseInt(seconds / 60) + ' minuto(s)';
    }

    return parseInt(seconds) + ' segundo(s)';
}

function normalizeCoord(coord) {
    switch (coord) {
        case 'n':
        case 'norte':
        case 'north':
        case 'cima':
            coord = 'n';
            break;
        case 's':
        case 'sul':
        case 'south':
        case 'baixo':
            coord = 's';
            break;
        case 'l':
        case 'e':
        case 'leste':
        case 'east':
        case 'direita':
        case 'dir':
            coord = 'l';
            break;
        case 'o':
        case 'w':
        case 'oeste':
        case 'west':
        case 'esquerda':
        case 'esq':
            coord = 'o';
    }
    return coord;
}

function findClosestCity(map, pos) {
    const radius = parseInt(MAX_DISTANCE_OBJECTS_DETECT / 2);
    let x0 = pos[0] - radius,
        y0 = pos[1] - radius,
        x1 = pos[0] + radius,
        y1 = pos[1] + radius;

    x0 = Math.max(Math.min(x0, MAP_HEIGHT - 1), 0);
    y0 = Math.max(Math.min(y0, MAP_WIDTH - 1), 0);
    x1 = Math.max(Math.min(x1, MAP_HEIGHT - 1), 0);
    y1 = Math.max(Math.min(y1, MAP_WIDTH - 1), 0);

    let shortestDistance = Infinity;
    let shortestCity = null;

    for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
            let cityPos = null;
            if (map[x][y].proxCity) {
                const xc = map[x][y].proxCity.origin[0],
                    yc = map[x][y].proxCity.origin[1];

                cityPos = [xc, yc];
            } else if (map[x][y].city) {
                cityPos = [x, y];
            }

            if (cityPos) {
                const distance = calcDistancePos(cityPos, pos);

                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    shortestCity = map[cityPos[0]][cityPos[1]].city.name;
                }
            }
        }
    }

    return shortestCity;
}

function isLevelAboveLoot(message, player, loot) {
    if (loot.levelMin > 0) {
        return message.member.id === player.id
            && message.member.roles.some(r => leveledRoles[loot.levelMin-1] === r.id);
    }

    return true;
}

function isDebug(message, args) {
    if (args.includes('--debug')) {
        if (message.channel instanceof Discord.DMChannel && message.author.id === '208028185584074763') {
            return true;
        }
    }
    return false;
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

module.exports = BattleRoyale;