
const fbAdmin = require("firebase-admin");
const fbServiceAccount = require("../misc/cafebot-2018-firebase-adminsdk-j17ic-a11e9f3222.json");
const utils = require('../utils');
const Discord = require("discord.js");
const ADMIN_IDS = require('../adminIds');

const DualMesh =     require('@redblobgames/dual-mesh');
const MeshBuilder =   require('@redblobgames/dual-mesh/create');
let Poisson = require('poisson-disk-sampling');
const SimplexNoise = require('simplex-noise');
const Map =          require('@redblobgames/mapgen2');

const fbApp = fbAdmin.initializeApp({
    credential: fbAdmin.credential.cert(fbServiceAccount),
    databaseURL: "https://cafebot-2018.firebaseio.com"
}, 'royale');

const db = fbApp.database();
const ref = db.ref('royale');

const equips = [
    {
        // por enquanto nada ainda, tenho q pensar em como implementar isso
        // de forma facil e rapida
    }
];

// são os tiles q serão colocados no mapa. eles podem ser andáveis ou não.
// o ratio vai dizer que algoritmo será usado pra colocar eles no mapa
const specialTiles = [
    {
        name: 'rio',
        ratio: 'radius',
        walkable: false
    }, {
        name: 'mar',
        ratio: 'border',
        walkable: false
    }, {
        name: 'árvore',
        ratio: 'random',
        walkable: false
    }
];

const tileHeightNames = [
    { max: 1, name: 'subida', fallName: 'descida' },
    { max: 3, name: 'morro', fallName: 'ladeira' },
    { max: 6, name: 'colina', fallName: 'ladeira ingrime' },
    { max: 9, name: 'montanha', fallName: 'precipício' },
];

// padrão
let MAP_WIDTH = 300;
let MAP_HEIGHT = 300;
let MAX_CASTS = 5;
let DELAY_CASTS = 6; // em horas
let FAIL_CAST_CHANCE = 0.25;
let REFLECT_CAST_CHANCE = 0.15;

// ref.child('config').on('value', snapshot => {
//     let config = snapshot.val();
//
//     MAP_WIDTH = config.mapWidth;
//     MAP_HEIGHT = config.mapHeight;
//
// });

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

        if (message.channel.id !== '461224031123800101') {
            message.reply(`:x: Só é permitido jogar o *royale* no <#461224031123800101>.`)
                .then(m => {
                    // deleta a mensagem dps de 8 segundos
                    m.delete(8000);
                });
            return;
        }

        if (Math.random() < 0.2) {
            // pra garantir que leia do banco de vez em quando caso o evento lá em cima falhar
            // ref.child('config').once('value', snapshot => {
            //     let config = snapshot.val();
            //
            //     MAP_WIDTH = config.mapWidth;
            //     MAP_HEIGHT = config.mapHeight;
            // });
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
            case 'v':
                return BattleRoyale.royaleVisionCommand(message, args);
            case 'n':
            case 'norte':
            case 'north':
            case 's':
            case 'sul':
            case 'south':
            case 'l':
            case 'leste':
            case 'e':
            case 'east':
            case 'o':
            case 'oeste':
            case 'w':
            case 'west':
                return BattleRoyale.royaleWalkCommand(message, arg, args);
            case 'generate':
                return BattleRoyale.generateMapCommand(message, args);
            case 'drop':
                return BattleRoyale.dropLootCommand(message, args);
            default:
                message.reply(`:x: Comando inexistente.\nComandos disponíveis: \`enter, exit, info, view, n, s, e, w\``);
        }
    }

    static royaleExitCommand(message, args) {}
    static royaleEnterCommand(message, args) {}
    static royaleStatsCommand(message, args) {}
    static royaleVisionCommand(message, args) {}
    static royaleWalkCommand(message, args) {}


    static generateMapCommand(message, args) {

        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            message.reply(`:x: *Você não tem permissão de gerar um mapa novo.*`);
            return;
        }

        let map = new Map(
            (new MeshBuilder({boundarySpacing: 75})).addPoisson(Poisson, 100).create(),
            {amplitude: 0.2, length: 4, seed: 12345},
            makeRandomInt
        );
        let noise = new SimplexNoise(12345);
        map.calculate({
            noise: noise
        });

        let polygons = [];
        for (let r = 0; r < map.mesh.numSolidRegions; r++) {
            polygons.push({
                biome: map.r_biome[r],
                //vertices: map.mesh.r_circulate_t([], r)
                //    .map((t) => map.t_pos([], t))
            });
        }

        console.log(map.mesh);
    }


    static dropLootCommand(message, args) {}

    // static wololoMyColorCommand(message, args) {
    //     const user = message.mentions.users.size === 1 ? message.mentions.users.first() : message.author;
    //
    //     if (user.bot) {
    //         message.reply(`:x: Bots não tem reino.`);
    //         return;
    //     }
    //
    //     if (typeof EXITS[user.id] !== 'undefined') {
    //         message.reply(`:x: Esta pessoa não está participando do jogo. **Não converta ela.**`);
    //         return;
    //     }
    //
    //     getInfo(user).then(info => {
    //         const colorSymbol = colors[info.color].symbol;
    //
    //         let myWololos = '';
    //         if (!hasWololo(info)) {
    //             const timeLeft = getTimeLeftForNextWololo(info);
    //             myWololos += `em ${timeLeft}`;
    //         } else {
    //             let wololosAvailable = 0;
    //             for (let i = 0; i < MAX_CASTS; i++) {
    //                 const time = (info.timestampCasts || [])[i];
    //
    //                 // se nao tem horario, entao ele tem slot
    //                 if (!time) {
    //                     wololosAvailable++;
    //                 }
    //
    //                 // se o horario que foi feito o wololo + 24 horas foi
    //                 // antes do horario atual, entao ele tem wololo
    //                 if (time + (DELAY_CASTS * 3600000) < (new Date()).getTime()) {
    //                     wololosAvailable++;
    //                 }
    //             }
    //
    //             myWololos += wololosAvailable + (wololosAvailable === 1 ? ` disponível` : ` disponíveis`);
    //         }
    //
    //         message.reply(`**Seu reino:** ${colorSymbol}. **Próximo wololo disponível:** ${myWololos}`);
    //     });
    // }
    //
    // static wololoStatsCommand(message, args) {
    //     const user = message.mentions.users.size === 1 ? message.mentions.users.first() : message.author;
    //
    //     if (user.bot) {
    //         message.reply(`:x: Bots não tem stats.`);
    //         return;
    //     }
    //
    //     if (typeof EXITS[user.id] !== 'undefined') {
    //         message.reply(`:x: Esta pessoa não está participando do jogo. **Não converta ela.**`);
    //         return;
    //     }
    //
    //     getInfo(user).then(info => {
    //         const now = parseInt((new Date()).getTime() / 1000);
    //         let stats = '';
    //
    //         const emb = new Discord.RichEmbed()
    //             .setColor(3447003)
    //             .setTitle(`Stats de ${user.username}`)
    //             .setDescription(`Reino atual: ${colors[info.color].symbol}`);
    //
    //         emb.addField(':wavy_dash:', `:speaking_head: __Wololos__`, false);
    //         emb.addField(`Bem sucedidos`, info.success || 0, true);
    //         emb.addField(`Falhos`, info.fail || 0, true);
    //         emb.addField(`Refletidos`, info.reflects || 0, true);
    //         emb.addField(`Defendidos`, info.defenses || 0, true);
    //
    //         const totalWololos = (info.success || 0) + (info.fail || 0);
    //         const rating = parseInt(((info.success || 0) / Math.max(totalWololos, 1)) * 100);
    //         emb.addField(`% Sucesso`, rating + '%', true);
    //         const ratingR = parseInt(((info.reflects || 0) / Math.max(totalWololos, 1)) * 100);
    //         emb.addField(`% Reflect`, ratingR + '%', true);
    //         const ratingD = parseInt(((info.defenses || 0) / Math.max(totalWololos, 1)) * 100);
    //         emb.addField(`% Defesas`, ratingD + '%', true);
    //
    //         emb.addField(':wavy_dash:', `:small_orange_diamond: __Streak__`, false);
    //         //emb.addField(`:shield: atuais`, info.shields || 0, true);
    //         emb.addField(`Streak de wololos atual`, info.streak || 0, true);
    //         emb.addField(`Melhor streak`, info.bestStreak || 0, true);
    //
    //         emb.addField(':wavy_dash:', `:scroll: __Claims__`, false);
    //         emb.addField(`Bem sucedidos`, info.claimsSuccess || 0, true);
    //         emb.addField(`Falhos`, info.claimsFail || 0, true);
    //
    //         emb.addField(':wavy_dash:', `:black_joker: __Jokers__`, false);
    //         emb.addField(`Vezes como joker`, info.jokerTimes || 0, true);
    //         emb.addField(`Swaps feitos`, info.swaps || 0, true);
    //
    //         const totalClaims = (info.claimsSuccess || 0) + (info.claimsFail || 0);
    //         const ratingC = parseInt(((info.claimsSuccess || 0) / Math.max(totalClaims, 1)) * 100);
    //         emb.addField(`% Sucesso`, ratingC + '%', true);
    //
    //         emb.addField(':wavy_dash:', `:timer: __Recordes e outros stats__`, false);
    //
    //         // if (user.id === '208028185584074763' || user.id === '132137996995526656') {
    //         //     stats += `**Tempo como ${colors[info.color].name}:** Pra sempre\n`;
    //         // } else {
    //         for (let i = 0; i < colors.length; i++) {
    //             let timeAs = info.timeAs[i] || 0;
    //             if (i === info.color && info.timeAsTimestamps[i]) {
    //                 // conta o tempo que vc ta com a cor atual, pois ainda nao foi convertido pra saber
    //                 timeAs += now - info.timeAsTimestamps[i];
    //             }
    //             const timeAsFormatted = formatTime(timeAs);
    //             //stats += `**Tempo como ${colors[i].name}:** ${timeAsFormatted}\n`;
    //             emb.addField(`Tempo como ${colors[i].symbol}`, timeAsFormatted, true);
    //         }
    //         // }
    //
    //         //message.channel.send(`Stats de ${user} ${colors[info.color].symbol}:\n\n${stats}`);
    //         message.channel.send({embed: emb});
    //     });
    // }
    //
    // static wololoConvertCommand(message, args) {
    //     const user = message.author;
    //     const userToConvert = message.mentions.users.first();
    //
    //     if (user.id === userToConvert.id) {
    //         message.reply(Math.random() > 0.9 ? `:x: aff eu convertendo` : `:x: Você não pode se converter!`);
    //         return;
    //     }
    //
    //     if (userToConvert.bot) {
    //         message.reply(`:x: Você não pode converter um bot.`);
    //         return;
    //     }
    //
    //     if (typeof EXITS[userToConvert.id] !== 'undefined') {
    //         message.reply(`:x: Esta pessoa não está participando do jogo. **Não converta ela.**`);
    //         return;
    //     }
    //
    //     // if (userToConvert.id === '208028185584074763' || userToConvert.id === '132137996995526656') {
    //     //     message.reply(`:x: Você não pode converter os líderes da resistência!`);
    //     //     return;
    //     // }
    //
    //     // function calculateMultiplier(color, minMemberThreshold, maxMemberThreshold, lowerMultiplier, upperMultiplier) {
    //     //     const membersCount = colors[convertInfo.color].count;
    //     //     const min = Math.max(0, membersCount - minMemberThreshold);
    //     //     const max = maxMemberThreshold - minMemberThreshold;
    //     //
    //     //     return Math.max(0.15, (10 - min) / 10);
    //     // }
    //
    //     getInfo(user).then(info => {
    //         getInfo(userToConvert).then(convertInfo => {
    //
    //             // verifica se o user tem wololo disponivel
    //             if (!hasWololo(info)) {
    //                 const timeLeft = getTimeLeftForNextWololo(info);
    //                 message.reply(`:x: Você não tem mais wololos por hoje. Volte em **${timeLeft}**.`);
    //                 return;
    //             }
    //
    //             if (info.color === convertInfo.color) {
    //                 message.reply(`:x: Você já estão no mesmo time.`);
    //                 return;
    //             }
    //
    //             const reflectRatingMultiplier = 0;
    //
    //             const fail = (Math.random() * 3000) < (3000 * FAIL_CAST_CHANCE);
    //             const reflect = (Math.random() * 3000) < (3000 * (REFLECT_CAST_CHANCE * ((colors[convertInfo.color].count <= 3) ? 1.4 : 0.5)));
    //             let wasShielded = false;
    //             let wasReflected = false;
    //             let oldColorReflected;
    //
    //             // descarta um wololo e conta
    //             info.castsUsed++;
    //             if (!info.timestampCasts) info.timestampCasts = [];
    //             info.timestampCasts.push((new Date()).getTime());
    //
    //             // verifica se ultrapassou o limite
    //             while (info.timestampCasts.length > MAX_CASTS) {
    //                 // vai tirando o cast mais antigo
    //                 info.timestampCasts.shift();
    //             }
    //
    //             // converte o inimigo, se nao for fail
    //             if (!fail) {
    //                 // se tiver shield, perde o shield e nao a cor
    //                 if (convertInfo.shields > 0) {
    //                     convertInfo.shields--;
    //                     wasShielded = true;
    //                 } else {
    //                     if (reflect) {
    //                         // refletiu
    //                         wasReflected = true;
    //                         oldColorReflected = info.color;
    //
    //                         if (info.shields > 0) {
    //                             info.shields--;
    //                             wasShielded = true;
    //                         } else {
    //
    //                             // contabiliza o tempo que ficou naquela cor
    //                             const now = parseInt((new Date()).getTime() / 1000);
    //                             if (!info.timeAs[info.color]) info.timeAs[info.color] = 0;
    //                             if (info.timeAsTimestamps[info.color]) {
    //                                 info.timeAs[info.color] += now - info.timeAsTimestamps[info.color];
    //                             }
    //                             info.timeAsTimestamps[convertInfo.color] = now;
    //                             // fim da contabilização -----
    //
    //                             // se não, converte mesmo
    //                             info.color = convertInfo.color;
    //                         }
    //
    //                     } else {
    //                         // contabiliza o tempo que ficou naquela cor
    //                         const now = parseInt((new Date()).getTime() / 1000);
    //                         if (!convertInfo.timeAs[convertInfo.color]) convertInfo.timeAs[convertInfo.color] = 0;
    //                         if (convertInfo.timeAsTimestamps[convertInfo.color]) {
    //                             convertInfo.timeAs[convertInfo.color] += now - convertInfo.timeAsTimestamps[convertInfo.color];
    //                         }
    //                         convertInfo.timeAsTimestamps[info.color] = now;
    //                         // fim da contabilização -----
    //
    //                         // se não, converte mesmo
    //                         convertInfo.color = info.color;
    //                     }
    //                 }
    //
    //                 info.streak = (info.streak || 0) + 1;
    //                 info._streak = (info._streak || 0) + 1;
    //                 info.bestStreak = Math.max((info.bestStreak || 0), info._streak);
    //
    //                 if (info.streak >= 5) {
    //                     // a cada 5 streaks, ganha um shield
    //                     // if (user.id === '208028185584074763' || user.id === '132137996995526656') {
    //                     //     // os lideres da resistencia nao precisam de shields
    //                     // } else {
    //                     info.shields = (info.shields || 0) + 1;
    //                     // }
    //                     info.streak = 0;
    //                 }
    //             } else {
    //                 // perde o streak
    //                 // TODO: e o shield?
    //                 info.streak = 0;
    //                 info._streak = 0;
    //             }
    //
    //             // contabiliza acertos e falhas
    //             const type = fail ? 'fail' : 'success';
    //             info[type] = (info[type] || 0) + 1;
    //             if (wasShielded) {
    //                 info.defenses = (info.defenses || 0) + 1;
    //             }
    //             if (wasReflected) {
    //                 info.reflects = (info.reflects || 0) + 1;
    //             }
    //
    //             const replyMsg = replyWololoMessage(user, userToConvert, info, convertInfo, fail, wasShielded, wasReflected, oldColorReflected);
    //             message.reply(replyMsg);
    //
    //             // salva as config dos users
    //             ref.child(`cores/${user.id}`).set(info);
    //             ref.child(`cores/${userToConvert.id}`).set(convertInfo);
    //
    //         })
    //     });
    // }
    //
    // static wololoClaimCommand(message, args) {
    //     const user = message.author;
    //     const colorToClaim = getColorFromArg(args[0]);
    //
    //     if (colorToClaim === false) {
    //         const colorsList = colors.map(c => `${c.name} ${c.symbol}`).join(' - ');
    //         message.reply(`:x: Este reino não existe. Use o *emoji* ou o *nome* do reino correspondente.\n\n**Reinos disponíveis:**\n${colorsList}`);
    //         return;
    //     }
    //
    //     getInfo(user).then(info => {
    //         // verifica se o user tem wololo disponivel
    //         if (!hasWololo(info)) {
    //             const timeLeft = getTimeLeftForNextWololo(info);
    //             message.reply(`:x: Você não tem mais wololos por hoje. Volte em **${timeLeft}**.`);
    //             return;
    //         }
    //
    //         // chance base pra conseguir um claim, depois eu vou diminuindo ele conforme algumas regras
    //         let chanceToClaim = 1;
    //
    //         // explicação: o -2 é pra considerar 0 a partir de duas pessoas ainda como aquele reino
    //         // o 10 é pq o rating vai de 2 até 10 pessoas com aquele reino, que vai diminuindo conforme
    //         // a quantidade de membros aumenta
    //         // minimo de 15% de chance caso dê 0
    //         const ratingCountMembers = colors[colorToClaim].count <= 1 ? 1 : Math.max(0.15, (10 - Math.max(0, colors[colorToClaim].count + 2)) / 10);
    //         chanceToClaim *= ratingCountMembers;
    //
    //         const claim = (Math.random() * 3000) < (3000 * chanceToClaim);
    //
    //         // descarta um wololo e conta
    //         info.castsUsed++;
    //         if (!info.timestampCasts) info.timestampCasts = [];
    //         info.timestampCasts.push((new Date()).getTime());
    //
    //         // verifica se ultrapassou o limite
    //         while (info.timestampCasts.length > MAX_CASTS) {
    //             // vai tirando o cast mais antigo
    //             info.timestampCasts.shift();
    //         }
    //
    //         // da claim, se nao for fail
    //         if (claim) {
    //             // se tiver shield, perde o shield e nao a cor
    //             // contabiliza o tempo que ficou naquela cor
    //             const now = parseInt((new Date()).getTime() / 1000);
    //             if (!info.timeAs[info.color]) info.timeAs[info.color] = 0;
    //             if (info.timeAsTimestamps[info.color]) {
    //                 info.timeAs[info.color] += now - info.timeAsTimestamps[info.color];
    //             }
    //             info.timeAsTimestamps[colorToClaim] = now;
    //             // fim da contabilização -----
    //
    //             // se não, converte mesmo
    //             info.color = colorToClaim;
    //         }
    //
    //         // contabiliza acertos e falhas
    //         const type = !claim ? 'claimsFail' : 'claimsSuccess';
    //         info[type] = (info[type] || 0) + 1;
    //
    //         const replyMsg = replyClaimMessage(user, info, colorToClaim, !claim);
    //         message.reply(replyMsg);
    //
    //         // salva as config dos users
    //         ref.child(`cores/${user.id}`).set(info);
    //     });
    // }
    //
    // static wololoSwapCommand(message, args) {
    //     const user = message.author;
    //     const colorSource = getColorFromArg(args[0]);
    //     const colorDest = getColorFromArg(args[1]);
    //
    //     if (colorSource === false || colorDest === false) {
    //         const colorsList = colors.map(c => `${c.name} ${c.symbol}`).join(' - ');
    //         message.reply(`:x: Este(s) reino(s) não existe(m). Use o *emoji* ou o *nome* do reino correspondente.\n\n**Reinos disponíveis:**\n${colorsList}`);
    //         return;
    //     }
    //
    //     getInfo(user).then(info => {
    //         // verifica se o user tem wololo disponivel
    //         if (!info.joker) {
    //             message.reply(`:x: Você precisa ser um joker para fazer isso.`);
    //             return;
    //         }
    //
    //         // descarta um wololo e conta
    //         info.castsUsed++;
    //         if (!info.timestampCasts) info.timestampCasts = [];
    //         info.timestampCasts.push((new Date()).getTime());
    //
    //         // verifica se ultrapassou o limite
    //         while (info.timestampCasts.length > MAX_CASTS) {
    //             // vai tirando o cast mais antigo
    //             info.timestampCasts.shift();
    //         }
    //
    //         // da claim, se nao for fail
    //         if (claim) {
    //             // se tiver shield, perde o shield e nao a cor
    //             // contabiliza o tempo que ficou naquela cor
    //             const now = parseInt((new Date()).getTime() / 1000);
    //             if (!info.timeAs[info.color]) info.timeAs[info.color] = 0;
    //             if (info.timeAsTimestamps[info.color]) {
    //                 info.timeAs[info.color] += now - info.timeAsTimestamps[info.color];
    //             }
    //             info.timeAsTimestamps[colorToClaim] = now;
    //             // fim da contabilização -----
    //
    //             // se não, converte mesmo
    //             info.color = colorToClaim;
    //         }
    //
    //         // contabiliza acertos e falhas
    //         const type = !claim ? 'claimsFail' : 'claimsSuccess';
    //         info[type] = (info[type] || 0) + 1;
    //
    //         const replyMsg = replyClaimMessage(user, info, colorToClaim, !claim);
    //         message.reply(replyMsg);
    //
    //         // salva as config dos users
    //         ref.child(`cores/${user.id}`).set(info);
    //     });
    // }
    //
    // static wololoScoreCommand(message, args) {
    //
    //     loadScore().then((response) => {
    //
    //         message.reply(`Placar rápido (**${response.totalMembers} participante(s)**):\n` + createFastScore(response.totalMembers));
    //
    //     }).catch(console.error);
    // }
    //
    // static wololoExitCommand(message, args) {
    //     const user = message.author;
    //
    //     if (!args[0]) {
    //         message.reply(`:x: Digite um motivo por qual quer sair do jogo.`);
    //         return;
    //     }
    //
    //     if (typeof EXITS[user.id] !== 'undefined') {
    //         message.reply(`:x: Você já está fora do jogo.`);
    //         return;
    //     }
    //
    //     getInfo(user).then(info => {
    //
    //         EXITS[user.id] = info;
    //         ref.child(`exits`).set(EXITS);
    //         ref.child(`cores/${user.id}`).set(null);
    //
    //         message.reply(':white_check_mark: Você será ignorado pelo jogo.');
    //     });
    //
    //     // const motivo = args.join(' ');
    //     // message.reply(`\n:door: **Requisição de exit do jogo**\nVocê precisa de pelo menos **3 votos :thumbsup: dos admins/mods** na sua mensagem para poder sair do jogo. Para cancelar, apenas apague sua mensagem.\n\n\`\`\`\nMotivo: ${motivo}\n\`\`\`<@&316568273296687104> <@&240269317361369088>`)
    //     //     .then(m => {
    //     //         // bot facilita a vida dos admins
    //     //         m.react('👍');
    //     //         const filter = (reaction, user) => reaction.emoji.name === '👍' && isAdmin(user);
    //     //         const collector = m.createReactionCollector(filter, { maxUsers: 4 });
    //     //         collector.on('collect', r => {
    //     //             if (r.count >= 4) {
    //     //                 getInfo(user).then(info => {
    //     //
    //     //                     EXITS[user.id] = info;
    //     //                     ref.child(`exits`).set(EXITS);
    //     //                     ref.child(`cores/${user.id}`).set(null);
    //     //
    //     //                     message.reply(':white_check_mark: Você será ignorado pelo jogo.');
    //     //                 });
    //     //                 collector.stop();
    //     //             }
    //     //             //return console.log(`Collected ${r.emoji.name}`);
    //     //         });
    //     //         //collector.on('end', collected => console.log(`Collected ${collected.size} items`));
    //     //     });
    //
    // }
    //
    // static wololoEnterCommand(message, args) {
    //     const user = message.author;
    //     const oldInfo = EXITS[user.id];
    //
    //     if (typeof EXITS[user.id] === 'undefined') {
    //         message.reply(`:x: Você já está dentro do jogo.`);
    //         return;
    //     }
    //
    //     // // volta tudo como estava antes dele sair
    //     // ref.child(`cores/${user.id}`).set(oldInfo);
    //     //
    //     // delete EXITS[user.id];
    //     // ref.child(`exits`).set(EXITS);
    //     //
    //     // message.reply(':white_check_mark: Você voltou ao jogo.');
    //
    //     message.reply(`\n:door: **Requisição de enter do jogo**\nVocê precisa de pelo menos **3 votos :thumbsup: dos admins/mods** na sua mensagem para poder entrar novamente do jogo. Para cancelar, apenas apague sua mensagem.\n\n<@&316568273296687104> <@&240269317361369088>`)
    //         .then(m => {
    //             // bot facilita a vida dos admins
    //             m.react('👍');
    //             const filter = (reaction, user) => reaction.emoji.name === '👍' && isAdmin(user);
    //             const collector = m.createReactionCollector(filter, { maxUsers: 4 });
    //             collector.on('collect', r => {
    //                 if (r.count >= 4) {
    //                     // volta tudo como estava antes dele sair
    //                     ref.child(`cores/${user.id}`).set(oldInfo);
    //
    //                     delete EXITS[user.id];
    //                     ref.child(`exits`).set(EXITS);
    //
    //                     message.reply(':white_check_mark: Você voltou ao jogo.');
    //
    //                     collector.stop();
    //                 }
    //                 //return console.log(`Collected ${r.emoji.name}`);
    //             });
    //             //collector.on('end', collected => console.log(`Collected ${collected.size} items`));
    //         });
    // }
    //
    // static wololoScoreboardCommand(message, args) {
    //
    //     if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
    //         message.reply(`:x: *Você não tem permissão pra isso.*`);
    //         return;
    //     }
    //
    //     // deleta a mensagem do comando
    //     message.delete();
    //     const scoreboardManager = new ScoreboardManager(message.channel);
    //
    //     loadScore().then(response => {
    //         let totalMembers = response.totalMembers;
    //         let members = response.members;
    //
    //         // atualiza a primeira vez
    //         scoreboardManager.handle(generateScoreboardContent(
    //             message.guild, members, totalMembers
    //         ));
    //
    //         const colorsRef = ref.child('cores');
    //
    //         colorsRef.on('child_added', (snapshot, prevKey) => {
    //             console.log('added', snapshot.val());
    //
    //             if (!members[snapshot.key]) {
    //                 const info = snapshot.val();
    //                 colors[info.color].count++;
    //
    //                 totalMembers++;
    //                 members[snapshot.key] = info;
    //
    //                 scoreboardManager.handle(generateScoreboardContent(
    //                     message.guild, members, totalMembers
    //                 ));
    //             }
    //
    //         });
    //
    //         // FIXME: como tratar uma alteração simples de cor se eu não tenho a referencia do que tava?
    //         // TODO: vai dar certo o jeito q eu fiz?
    //         colorsRef.on('child_changed', snapshot => {
    //             console.log('changed', snapshot.val());
    //
    //             if (members[snapshot.key]) {
    //                 const info = snapshot.val();
    //                 const oldInfo = members[snapshot.key];
    //
    //                 colors[info.color].count++;
    //                 colors[oldInfo.color].count--;
    //
    //                 // atualiza com o novo
    //                 members[snapshot.key] = info;
    //
    //                 scoreboardManager.handle(generateScoreboardContent(
    //                     message.guild, members, totalMembers
    //                 ));
    //             }
    //         });
    //
    //         colorsRef.on('child_removed', snapshot => {
    //             console.log('removed', snapshot.val());
    //
    //             if (members[snapshot.key]) {
    //                 const info = snapshot.val();
    //                 colors[info.color].count--;
    //
    //                 totalMembers--;
    //                 delete members[snapshot.key];
    //
    //                 scoreboardManager.handle(generateScoreboardContent(
    //                     message.guild, members, totalMembers
    //                 ));
    //             }
    //         });
    //
    //
    //     }).catch(console.error);
    // }

    static onGuildMemberRemove(member) {
        // retira os membros do jogo quando eles quitarem do server
        const user = member.user;
        ref.child(`members/${user.id}`).set(null);
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

function loadScore() {
    return new Promise((resolve, reject) => {
        const colorsRef = ref.child('cores');

        // zera os counts das cores primeiro
        for (let i = 0; i < colors.length; i++) {
            colors[i].count = 0;
        }

        colorsRef.once('value', (snapshot, prevKey) => {
            //console.log('value', snapshot.val());
            const allMembers = snapshot.val();

            if (!allMembers) {
                reject('no members');
                return;
            }

            // conta todos uma unica vez
            let count = 0;
            for (let id in allMembers) {
                if (!allMembers.hasOwnProperty(id)) continue;

                colors[allMembers[id].color].count++;
                count++;
            }

            resolve({ members: allMembers, totalMembers: count });
        });
    });
}

function createFastScore(totalMembers) {
    let colorScores = [];
    for (let i = 0; i < colors.length; i++) {
        //console.log('COUNT', i, colors[i].count, totalMembers);
        const score = parseInt((colors[i].count / Math.max(1,totalMembers)) * 100);
        colorScores.push(`${colors[i].symbol} ${score}% (${colors[i].count})`);
    }
    return colorScores.join(' :heavy_multiplication_x: ');
}

function replyWololoMessage(user, convertUser, info, convertInfo, fail, wasShielded, wasReflected, oldColorReflected) {
    let resultEmoji = '', message = '';
    const colorEmoji = wasReflected ? colors[ oldColorReflected ].symbolStreak : colors[ info.color ].symbolStreak;
    const oldConvertUserColorEmoji = colors[ convertInfo.color ].symbol;
    const newConvertUserColorEmoji = colors[ info.color ].symbol;

    switch (true) {
        case wasReflected:
            resultEmoji = ':repeat:' + oldConvertUserColorEmoji;
            if (wasShielded) {
                resultEmoji += '   :wavy_dash::shield:';

                const stillReflectedEmoji = colors[ oldColorReflected ].symbol;
                message = `**${convertUser} refletiu, mas você usou escudo!** ${user} continua ${stillReflectedEmoji}`;
            } else {
                message = `**${convertUser} refletiu!** ${user} agora é ${oldConvertUserColorEmoji}`;
            }
            break;
        case wasShielded:
            resultEmoji = ':shield:';
            message = `**Usou escudo!** ${convertUser} continua ${oldConvertUserColorEmoji}`;
            break;
        case fail:
            resultEmoji = ':heavy_multiplication_x:';
            message = `**Falhou!** ${convertUser} continua ${oldConvertUserColorEmoji}`;
            break;
        default:
            resultEmoji = ':white_check_mark:';
            message = `**Sucesso!** ${convertUser} agora é ${newConvertUserColorEmoji}`;
            break;
    }

    //const emojiText = `:speaking_head:  \\--{ *wololo* }  :wavy_dash:${colorEmoji}:wavy_dash:${colorEmoji}:wavy_dash:${resultEmoji}`;
    const emojiText = `:speaking_head:     :wavy_dash:${colorEmoji}:wavy_dash:${colorEmoji}:wavy_dash:${resultEmoji}`;

    return `\n${emojiText}\n\n${message}`;

}

function replyClaimMessage(user, info, colorToClaim, fail) {
    let resultEmoji = '', message = '';
    const colorEmoji = colors[ colorToClaim ].symbolStreak;
    const oldConvertUserColorEmoji = colors[ info.color ].symbol;
    const newConvertUserColorEmoji = colors[ colorToClaim ].symbol;

    switch (true) {
        case fail:
            resultEmoji = ':heavy_multiplication_x:';
            message = `**Falhou!** Você continua ${oldConvertUserColorEmoji}`;
            break;
        default:
            resultEmoji = ':white_check_mark:';
            message = `**Sucesso!** Você agora é ${newConvertUserColorEmoji}`;
            break;
    }

    const emojiText = `:bust_in_silhouette::scroll:     :curly_loop:${colorEmoji}:curly_loop:${colorEmoji}:curly_loop:${resultEmoji}`;

    return `\n${emojiText}\n\n${message}`;

}

function generateColor(user) {
    // if (user.id === '208028185584074763') {
    //     return 1; // sempre vermelho pra mim
    // } else if (user.id === '132137996995526656') {
    //     return 0; // sempre azul pra dani
    // }

    const threshold = 50000 / colors.length;
    // let factor = utils.seededRandom(user.discriminator) * 50000;
    let factor = Math.random() * 50000;

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

function getInfo(user, forceColor) {
    return new Promise((resolve, reject) => {
        const coreUserRef = ref.child(`cores/${user.id}`);

        coreUserRef.once('value', snapshot => {
            let info = snapshot.val();

            if (!info) {
                const generatedColor = forceColor !== undefined ? forceColor : generateColor(user);
                let timeAs = {}, timeAsTimestamps = {};

                for (let i = 0; i < colors.length; i++) {
                    timeAs[i] = 0;
                    timeAsTimestamps[i] = 0;
                }

                // coloca a primeira cor no timestamp
                timeAsTimestamps[generatedColor] = parseInt((new Date()).getTime() / 1000);

                info = {
                    color: generatedColor,
                    timestampCasts: [],
                    castsUsed: 0,
                    shields: 0,
                    streak: 0,
                    bestStreak: 0,
                    success: 0,
                    fail: 0,
                    reflects: 0,
                    defenses: 0,
                    claimsSuccess: 0,
                    claimsFail: 0,
                    swaps: 0,
                    jokerTimes: 0,
                    joker: false,
                    timeAs: timeAs,
                    timeAsTimestamps: timeAsTimestamps,
                };
                // salva o que foi definido, se ele não tiver
                coreUserRef.set(info);
            }

            resolve(info);
        });
    });
}

function hasWololo(info) {
    for (let i = 0; i < MAX_CASTS; i++) {
        const time = (info.timestampCasts || [])[i];

        // se nao tem horario, entao ele tem slot
        if (!time) {
            console.log('HASWOLOLO', 'não achei time, true');
            return true;
        }

        // se o horario que foi feito o wololo + 24 horas foi
        // antes do horario atual, entao ele tem wololo
        console.log('HASWOLOLO', time, (new Date()).getTime());
        if (time + (DELAY_CASTS * 3600000) < (new Date()).getTime()) {
            return true;
        }
    }

    console.log('HASWOLOLO', 'false');
    return false;
}

function getTimeLeftForNextWololo(info) {
    const oldestTimestampCast = info.timestampCasts.slice().sort();
    let diffSeconds = (DELAY_CASTS * 3600) - ((new Date()).getTime() - oldestTimestampCast[0]) / 1000;

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

/**
 *
 * @param {?Discord.Guild} guild
 * @param members
 * @param totalMembers
 * @return {string}
 */
function generateScoreboardContent(guild, members, totalMembers) {
    if (!guild) return '[ Placar não está numa guild válida ]';

    let content = [];
    content.push(`**Participantes:** ${totalMembers}\n\n`);

    for (let id in members) {
        if (!members.hasOwnProperty(id)) continue;
        //if (!guild.members.get(id)) continue; // usuario já não é mais membro do server, ignorar
        const m = members[id];

        const colorEmoji = m.joker ? ':black_joker:' : colors[m.color].symbol;
        const userName = guild.members.get(id) ? guild.members.get(id).user.username : id;
        const shieldEmoji = m.shields > 0 ? ` **${m.shields}** :shield:` : '';
        const streakEmojis = m.streak > 0 ? ':small_orange_diamond:'.repeat(m.streak) + `` : '';
        const leaderEmoji = /*id === '208028185584074763' || id === '132137996995526656' ? `:crown: ` : */'';

        content.push(`${colorEmoji} ${leaderEmoji}${userName}${streakEmojis}\n`);
    }

    content.push(`\n**Ignorados pelo jogo:** Não converta estas pessoas!\n\n`);

    for (let id in EXITS) {
        if (!EXITS.hasOwnProperty(id)) continue;
        if (!guild.members.get(id)) continue; // usuario já não é mais membro do server, ignorar

        const userName = guild.members.get(id).user.username + '#' + guild.members.get(id).user.discriminator;

        content.push(`:x: ${userName}\n`);
    }

    content.push(`\n` + createFastScore(totalMembers));

    const lastUpdate = (new Date()).toLocaleString();
    content.push(`\n\n*última atualização: ${lastUpdate} GMT*`);

    return content;
}

function getColorFromArg(arg) {
    for (let i = 0; i < colors.length; i++) {
        let lowerArg = arg;
        try { lowerArg = lowerArg.toLowerCase(); } catch (e) {}
        if (arg === colors[i].emoji || lowerArg === colors[i].name.toLowerCase() || lowerArg === colors[i].plural.toLowerCase()) {
            return i;
        }
    }
    return false;
}

function logEvent(event) {
    const logRef = ref.child(`log`);
    logRef.push().set({ event: event, ts: new Date() });
}

function isAdmin(user) {
    return ADMIN_IDS.includes(user.id);
    //return member.roles.some(r => ["Manage Server"].includes(r.name));
}

module.exports = BattleRoyale;