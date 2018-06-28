
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
        // por enquanto nada ainda, tenho q pensar em como implementar isso
        // de forma facil e rapida
    }
];

const cities = [
    { name: 'San Haj', radius: 5, biomes: true },
    { name: 'Baía do glub', radius: 3, biomes: ['BEACH'] },
    { name: 'Escola do ABC', radius: 2, biomes: true },
    { name: 'Lago do grande mij', radius: 2, biomes: ['LAKE', 'MARSH', 'ICE'] },
    { name: 'Floresta da decepção', radius: 3, biomes: ['TEMPERATE_RAIN_FOREST', 'TEMPERATE_DECIDUOUS_FOREST'] },
];

const distances = [
    { value: 0, name: 'aqui' },
    { value: 1, name: 'muito perto' },
    { value: 2, name: 'bem perto' },
    { value: 4, name: 'perto' },
    { value: 6, name: 'pouco longe' },
    { value: 10, name: 'bem longe' },
    { value: Infinity, name: 'muito longe' },
];

// padrão
let MAP_WIDTH = 62;
let MAP_HEIGHT = 28;
let MAX_VISION = 5;
let MAX_DISTANCE_OBJECTS_DETECT = 15;
let MAX_WALKS = 30;
let DELAY_WALKS = 10; // em minutos

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
            rio: client.emojis.find("name", "rr")
        };

        // if (message.channel.id !== '461224031123800101') {
        //     message.reply(`:x: Só é permitido jogar o *royale* no <#461224031123800101>.`)
        //         .then(m => {
        //             // deleta a mensagem dps de 8 segundos
        //             m.delete(8000);
        //         });
        //     return;
        // }

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
            case 'walk':
            case 'w':
                return BattleRoyale.royaleWalkCommand(message, args);
            case 'generate-map':
                return BattleRoyale.generateMapCommand(message, args);
            case 'view-map':
                return BattleRoyale.viewMapCommand(message, args);
            case 'drop-loot':
            case 'loot':
                return BattleRoyale.dropLootCommand(message, args);
            default:
                message.reply(`:x: Comando inexistente.\nComandos disponíveis: \`enter, exit, info, view, walk\``);
        }
    }

    static royaleExitCommand(message, args) {

        exitPlayer(message.author).then(successMsg => {
            const channel = getRoyaleChannel(message);
            channel.send(successMsg);
        }).catch(error => {
            message.reply(`:x: ${error}`);
        })
    }

    static royaleEnterCommand(message, args) {

        createPlayer(message.author).then(([ exists, player ]) => {
            const channel = getRoyaleChannel(message);

            if (exists) {
                message.reply(`:thumbsup: Você já está no jogo!`);
            } else {
                channel.send(`:inbox_tray: Usuário ${message.author} entrou no jogo!`);
                console.log('ENTER', player);
            }

        }).catch(error => {
            message.reply(`:x: ${error}`);
        })
    }

    static royaleStatsCommand(message, args) {}

    static royaleVisionCommand(message, args) {
        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([map, players, loots]) => {
            getPlayer(message.author).then(player => {
                const channel = getRoyaleChannel(message);

                message.reply(`pos: ${player.pos[0]}, ${player.pos[1]}`);

                let coord = normalizeCoord(args[0]);

                const vision = calcVision(map, player.pos[0], player.pos[1], coord, MAX_DISTANCE_OBJECTS_DETECT);

                let textMap = renderVision(vision, coord, players, loots);
                // for (let v = 0; v < MAX_VISION; v++) {
                //     const x = vision[v];
                //     const row = x.map(y => renderTile(y, players, loots)).join('');
                //     const blanks = (1 + (2 * (MAX_VISION - 1))) - x.length;
                //     const midBlank = parseInt(blanks / 2);
                //
                //     textMap += (`${tileEmojis.empty}`.repeat(midBlank)) + row;
                //     textMap += "\n";
                // }

                // encontrar proximidades
                let textProx = "";
                let gone = [];
                for (let d = 0; d < MAX_DISTANCE_OBJECTS_DETECT; d++) {
                    for (let i = 0; i < vision[d].length; i++) {
                        const tile = vision[d][i];

                        // se tem cidade
                        if (tile.proxCity) {
                            const city = map[tile.proxCity.origin[0]][tile.proxCity.origin[1]].city;
                            const cityName = city.name;

                            if (!gone.includes('c:' + cityName)) {
                                const distance = calcDistance(
                                    player.pos[0], player.pos[1],
                                    tile.proxCity.origin[0], tile.proxCity.origin[1]
                                ) - city.radius;

                                const distanceNam = distanceName(distance);

                                textProx += `O local **${cityName}** está ${distanceNam}\n`;

                                gone.push('c:' + cityName);
                            }
                        }

                        // se tem loot
                        let loot = getLootFromTile(tile, loots);
                        if (loot) {
                            console.log('LOOT', loot);
                            const lootName = loot.name;

                            if (!gone.includes('l:' + lootName)) {
                                const distance = calcDistance(
                                    player.pos[0], player.pos[1],
                                    tile.pos[0], tile.pos[1]
                                );

                                const distanceNam = distanceName(distance);

                                textProx += `Um drop **${lootName}** está ${distanceNam}\n`;

                                gone.push('l:' + lootName);
                            }
                        }

                        // se tem player
                        let playerFound = getPlayerFromTile(tile, players);
                        if (playerFound && playerFound.id !== player.id) {
                            console.log('PLAYER', playerFound);
                            const playerId = playerFound.id;

                            if (!gone.includes('p:' + playerId)) {
                                const distance = calcDistance(
                                    player.pos[0], player.pos[1],
                                    tile.pos[0], tile.pos[1]
                                );

                                const distanceNam = distanceName(distance);

                                textProx += `Um jogador **${playerId}** está ${distanceNam}\n`;

                                gone.push('p:' + playerId);
                            }
                        }
                    }
                }

                message.reply(`Visão:\n${textMap}\nProximidades:\n${textProx}`);


            }).catch(error => {
                console.error(error);
                message.reply(`:x: ${error}`);
            });
        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        })
    }

    static royaleWalkCommand(message, args) {
        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([map, players, loots]) => {
            getPlayer(message.author).then(player => {
                const channel = getRoyaleChannel(message);

                let walks = walkSyntaxToWalks(args.join(" "));
                let availableWalks = getWalksAvailable(player);

                if (availableWalks < walks.length) {
                    const timeLeft = getTimeLeftForNextWalk(player);
                    message.reply(`:x: Você não tem passos suficientes (tem: ${availableWalks}, precisa: ${walks.length}).` + (availableWalks === 0 ? ` Volte em **${timeLeft}** para mais passos.` : ''));
                    return;
                }

                // marca aqui coisas q vc andou por cima, mas nao pegou
                let steppedBy = [];

                // anda
                let newPos = [ player.pos[0], player.pos[1] ];
                for (let w = 0; w < walks.length; w++) {
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
                        const terrain = renderTile(tile);
                        message.reply(`:x: Ops! No passo **${w+1}** você encontrou ${terrain} e você não pode passar sobre. Você continua na mesma posição e pode tentar andar novamente.`);
                        return;
                    } else {
                        if (getPlayerFromTile(tile, players)) {
                            steppedBy.push({
                                type: 'player',
                                action: 'lutou',
                                pos: tile.pos
                            })
                        } else if (getLootFromTile(tile, loots)) {
                            steppedBy.push({
                                type: 'loot',
                                action: 'pegou',
                                pos: tile.pos
                            })
                        }
                    }
                }

                // muda alguns stats e descarta os walks usados
                player.walksUsed += walks.length;
                availableWalks -= walks.length;
                if (!player.timestampWalks) player.timestampWalks = [];
                for (let w = 0; w < walks.length; w++) {
                    player.timestampWalks.push((new Date()).getTime());
                }

                // coloca o player na nova posição
                player.pos = newPos;

                const newTile = map[player.pos[0]][player.pos[1]];

                // se tem loot
                let loot = getLootFromTile(newTile, loots);
                if (loot) {
                    player.loot = player.loot || [];

                    // adiciona o loot pro player
                    player.loot.push(loot);

                    // e tira ele da lista de loots no mapa
                    loots.splice(loots.indexOf(loot), 1);

                    // salva os loots
                    ref.child(`loot`).set(loots);
                }

                // se tem player
                let playerFound = getPlayerFromTile(newTile, players);
                if (playerFound && playerFound.id !== player.id) {
                    // começa uma luta!
                    const win = (Math.random() * 2000) <= 1000;

                    if (win) {
                        // se ganhou, pega todos os loots do outro player

                    }
                }

                ref.child(`player/${player.id}`).set(player);

                message.reply(`pos nova: ${newPos[0]}, ${newPos[1]}`);

                const timeLeft = getTimeLeftForNextWalk(player);
                const distanceWalked = distanceName(walks.length);
                const steppedByText = steppedBy.filter(sb => {
                    // tira todos os stepped by que SÃO o tile q vc ta pisando
                    return sb.pos[0] !== player.pos[0] && sb.pos[1] !== player.pos[1];
                }).map(sb => {
                    return 'você passou por um ' + sb.type
                        + ', mas não '
                        + sb.action + ' há uns '
                        + distanceName(calcDistance(sb.pos[0], sb.pos[1], player.pos[0], player.pos[1]));
                }).join("\n");
                message.reply(`:white_check_mark: Você andou **${distanceWalked}**, ` + (availableWalks === 0 ? `mas não tem mais passos disponíveis. Volte em **${timeLeft}** para mais passos.` : `e ainda tem ${availableWalks} passos disponíveis.`) + (steppedByText ? `\nEnquanto andava...\n` + steppedByText : ''));

                // let coord = normalizeCoord(args[0]);
                //
                // const vision = calcVision(map, player.pos[0], player.pos[1], coord, MAX_DISTANCE_OBJECTS_DETECT);
                //
                // let textMap = renderVision(vision, coord, players, loots);
                //
                // // encontrar proximidades
                // let textProx = "";
                // let gone = [];
                // for (let d = 0; d < MAX_DISTANCE_OBJECTS_DETECT; d++) {
                //     for (let i = 0; i < vision[d].length; i++) {
                //         const tile = vision[d][i];
                //
                //         // se tem cidade
                //         if (tile.proxCity) {
                //             const city = map[tile.proxCity.origin[0]][tile.proxCity.origin[1]].city;
                //             const cityName = city.name;
                //
                //             if (!gone.includes('c:' + cityName)) {
                //                 const distance = calcDistance(
                //                     player.pos[0], player.pos[1],
                //                     tile.proxCity.origin[0], tile.proxCity.origin[1]
                //                 ) - city.radius;
                //
                //                 const distanceNam = distanceName(distance);
                //
                //                 textProx += `O local **${cityName}** está ${distanceNam}\n`;
                //
                //                 gone.push('c:' + cityName);
                //             }
                //         }
                //
                //         // se tem loot
                //         let loot = getLootFromTile(tile, loots);
                //         if (loot) {
                //             console.log('LOOT', loot);
                //             const lootName = loot.name;
                //
                //             if (!gone.includes('l:' + lootName)) {
                //                 const distance = calcDistance(
                //                     player.pos[0], player.pos[1],
                //                     tile.pos[0], tile.pos[1]
                //                 );
                //
                //                 const distanceNam = distanceName(distance);
                //
                //                 textProx += `Um drop **${lootName}** está ${distanceNam}\n`;
                //
                //                 gone.push('l:' + lootName);
                //             }
                //         }
                //
                //         // se tem player
                //         let playerFound = getPlayerFromTile(tile, players);
                //         if (playerFound && playerFound.id !== player.id) {
                //             console.log('PLAYER', playerFound);
                //             const playerId = playerFound.id;
                //
                //             if (!gone.includes('p:' + playerId)) {
                //                 const distance = calcDistance(
                //                     player.pos[0], player.pos[1],
                //                     tile.pos[0], tile.pos[1]
                //                 );
                //
                //                 const distanceNam = distanceName(distance);
                //
                //                 textProx += `Um jogador **${playerId}** está ${distanceNam}\n`;
                //
                //                 gone.push('p:' + playerId);
                //             }
                //         }
                //     }
                // }
                //
                // message.reply(`Visão:\n${textMap}\nProximidades:\n${textProx}`);


            }).catch(error => {
                console.error(error);
                message.reply(`:x: ${error}`);
            });
        }).catch(error => {
            console.error(error);
            message.reply(`:x: ${error}`);
        })
    }

    static generateMapCommand(message, args) {

        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            message.reply(`:x: *Você não tem permissão de gerar um mapa novo.*`);
            return;
        }

        let seed = args[0] || 78;

        let map = new Map(
            (new MeshBuilder({boundarySpacing: 75})).addPoisson(Poisson, 50).create(),
            {amplitude: 0.2, length: 4, seed: seed},
            makeRandomInt
        );
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

        console.log(polygons);

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

        saveMap(arrayMap);

        // verifica se tem loots no mapa, pra poder reespalhar
        getLoots().then(loots => {
            // se tiver loots no mapa, respalhar eles
            if (loots.length) {
                let lootPromises = [];
                for (let i = 0; i < loots.length; i++) {
                    lootPromises.push(getRandomWalkableTile());
                }

                Promise.all(lootPromises).then(tiles => {
                    const lootRef = ref.child(`loot`);

                    for (let i = 0; i < loots.length; i++) {
                        loots[i].pos = tiles[i];
                    }

                    // salva o novo array de loots
                    lootRef.set(loots);

                    console.log('LOOTS REESPALHADOS COM SUCESSO');

                });
            }
        });

        // renderiza o mapa aproveitando o metodo q ja faz só isso
        BattleRoyale.viewMapCommand(message, args);
    }

    static viewMapCommand(message, args) {
        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            message.reply(`:x: *Você não tem permissão de usar esse comando.*`);
            return;
        }

        Promise.all([
            getMap(),
            getPlayers(),
            getLoots()
        ]).then(([map, players, loots]) => {

            const texts = renderMap(
                map,
                args.includes('--no-players') ? null : players,
                args.includes('--no-loots') ? null : loots,
                !args.includes('--no-city')
            );

            message.channel.send("**Mapa** (escala 1/2)\nCada *1 tile real* equivale a *100m*");

            function _sendMapPiece() {
                const mapText = texts.shift();
                return message.channel.send(mapText)
                    .then(() => {
                        if (texts.length) {
                            // continua enquanto tiver emoji pra mandar
                            return _sendMapPiece();
                        }
                        // acabou os emojis
                        return true;
                    }).catch(console.error);
            }

            _sendMapPiece().then(() => {
                console.log('RENDERIZOU O MAPA');
            })
        });
    }


    static dropLootCommand(message, args) {

        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
            message.reply(`:x: *Você não tem permissão de dropar um loot.*`);
            return;
        }

        const lootName = args[0];
        const channel = getRoyaleChannel(message);

        getRandomWalkableTile(args[1], args[2]).then(tile => {
            const lootRef = ref.child(`loot`);

            lootRef.once('value', snapshot => {
                let loots = snapshot.val();

                if (!loots) {
                    loots = [];
                }

                loots.push({
                    name: lootName,
                    pos: tile,
                    ts: (new Date()).getTime()
                });

                // salva o novo array de loots
                lootRef.set(loots);

                channel.send(`:gift: **Atenção!** Um drop caiu na ilha! O loot é **${lootName}**!`);
            });

        }).catch(error => {
            message.reply(`:x: ${error}`);
        })
    }

    static onGuildMemberRemove(member) {
        // retira os membros do jogo quando eles quitarem do server
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
    const ch = message.guild.channels.get('461224031123800101');
    if (!ch) {
        return message.channel;
    }
    return ch;
}

/**
 * Retorna a letra daquele bioma
 */
function renderTile(tile, players, loots) {
    //return `[BIOME: ${tile.biome}, X: ${tile.pos[0]}, Y: ${tile.pos[1]}]`;
    let p = players ? getPlayerFromTile(tile, players) : null,
        l = loots ? getLootFromTile(tile, loots): null;
    if (p) {
        return tileEmojis.player;
    }
    if (l) {
        return tileEmojis.loot;
    }
    if (tile.biome === 'OCEAN') return tileEmojis.oceano; //return '▓';
    if (tile.biome === 'BEACH') return tileEmojis.areia; //return '░';
    if (tile.biome === 'TEMPERATE_RAIN_FOREST'
        || tile.biome === 'TEMPERATE_DECIDUOUS_FOREST'
        || tile.biome === 'TROPICAL_RAIN_FOREST'
        || tile.biome === 'TROPICAL_SEASONAL_FOREST') return Math.random() < 0.1 ? tileEmojis.arvore : tileEmojis.arvore2; //'▓';
    if (tile.biome === 'LAKE'
        || tile.biome === 'MARSH'
        || tile.biome === 'ICE') return tileEmojis.rio;
    if (tile.biome === 'TEMPERATE_DESERT'
        || tile.biome === 'SUBTROPICAL_DESERT'
        || tile.biome === 'SHRUBLAND') return tileEmojis.deserto; //return '▒';
    if (tile.biome === 'GRASSLAND'
        || tile.biome === 'TAIGA') return tileEmojis.grama; //return '▒';
    return tileEmojis.empty;
}

function getPlayer(user) {
    return new Promise((resolve, reject) => {
        const coreUserRef = ref.child(`player/${user.id}`);

        coreUserRef.once('value', snapshot => {
            let info = snapshot.val();

            if (!info) {
                reject('Usuário não está jogando. Use `+royale enter` pra participar.');
            } else {
                resolve(info);
            }
        });
    });
}

function createPlayer(user) {
    return new Promise((resolve, reject) => {
        const coreUserRef = ref.child(`player/${user.id}`);

        coreUserRef.once('value', snapshot => {
            let info = snapshot.val();

            if (!info) {
                getRandomWalkableTile().then(tile => {
                    info = {
                        id: user.id,
                        deaths: 0,
                        wins: 0,
                        loot: [],
                        timestampWalks: [],
                        walksUsed: 0,
                        pos: tile
                    };

                    // salva o que foi definido
                    coreUserRef.set(info);

                    resolve([false, info]);

                }).catch(reject);
            } else {
                resolve([true, info]);
            }

        });
    });
}

function respawnPlayer(user, inBattle) {
    return new Promise((resolve, reject) => {
        Promise.all([
            getPlayer(user),
            getLoots()
        ]).then(([ player, loots ]) => {
            getRandomWalkableTile().then(tile => {
                // seta novo tile pro player
                player.pos = tile;
                // aumenta uma morte
                player.deaths++;

                // se for em batalha, não perde os passos
                if (!inBattle) {

                }

                if (player.loot && player.loot.length) {
                    let playerLoots = utils.shuffle(player.loot);
                    let lostLoot = playerLoots.shift(); // pega o primeiro loot, depois de embaralhar os loots
                    getRandomWalkableTile().then(tile => {
                        loots.push({
                            name: lostLoot.name,
                            pos: tile,
                            ts: (new Date()).getTime()
                        });

                        // seta os loots do player, faltando aquele q ele perdeu respawnando
                        player.loot = playerLoots;

                        ref.child(`loot`).set(loots);
                        ref.child(`player/${user.id}`).set(player);
                    });
                } else {
                    // salva se não tem loot pra perder
                    ref.child(`player/${user.id}`).set(player);
                }

            }).catch(reject);

        }).catch(reject);
    });
}

function exitPlayer(user) {
    return new Promise((resolve, reject) => {
        getPlayer(user).then(player => {
            // se tiver loot, espalhar eles no mapa
            if (player.loot && player.loot.length) {
                let lootPromises = [];
                for (let i = 0; i < player.loot.length; i++) {
                    lootPromises.push(getRandomWalkableTile());
                }

                Promise.all(lootPromises).then(tiles => {
                    const lootRef = ref.child(`loot`);

                    lootRef.once('value', snapshot => {
                        let loots = snapshot.val();
                        let droppedLoots = [];

                        if (!loots) {
                            loots = [];
                        }

                        for (let i = 0; i < player.loot.length; i++) {
                            const loot = player.loot[i],
                                  tile = tiles[i];

                            loots.push({
                                name: loot.name,
                                pos: tile,
                                ts: (new Date()).getTime()
                            });

                            droppedLoots.push(loot.name);
                        }

                        // salva o novo array de loots
                        lootRef.set(loots);

                        // deleta o usuario da lista
                        ref.child(`player/${user.id}`).set(null);

                        resolve(`:outbox_tray: Usuário ${user} saiu do jogo e deixou os loots espalhados: **${droppedLoots.join('**, **')}**`);
                    });

                }).catch(reject);
            } else {
                // não tem loot pra espalhar, entao simplesmente deleta o usuario
                ref.child(`player/${user.id}`).set(null);

                resolve(`:outbox_tray: Usuário ${user} saiu do jogo!`);
            }

        }).catch(reject);
    });
}

function getPlayers() {
    return new Promise((resolve, reject) => {
        const coreUserRef = ref.child(`player`);

        coreUserRef.once('value', snapshot => {
            let players = snapshot.val();

            if (!players) {
                resolve({});
            } else {
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

function getRandomWalkableTile(forceX, forceY, tries) {
    return new Promise((resolve, reject) => {
        getMap().then(map => {
            getPlayers().then(players => {
                tries = tries || 200;

                if (forceX && forceY) {
                    let xa = forceX,
                        ya = forceY;

                    if (map[xa][ya].walkable && !getPlayerFromTile({ pos: [xa, ya] })) {
                        resolve([xa, ya]);
                    } else {
                        reject('Não pode ser colocado neste tile.');
                    }
                } else {
                    while (tries--) {
                        let xa = parseInt(Math.random() * MAP_HEIGHT),
                            ya = parseInt(Math.random() * MAP_WIDTH);

                        if (map[xa][ya].walkable && !getPlayerFromTile({ pos: [xa, ya] })) {
                            resolve([xa, ya]);
                            return;
                        }
                    }

                    reject('Houve um erro inesperado e não foi possível detectar um tile no momento. Tente novamente.');
                }

            }).catch(reject);

        }).catch(reject);
    });
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
        return ref.child(`map`).set(map);
    });
}

function calcDistance(xorig, yorig, xdest, ydest) {
    const dx = xorig - xdest,
        dy = yorig - ydest;
    const hipotenuse = dx*dx + dy*dy;
    return Math.sqrt(hipotenuse);
}

function distanceName(distance) {
    return Math.round(distance * 100) + ' metros';
    //return distance;
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
                //console.log('VISION '+ i, map[xo][yo].biome);

                vision[i].push(map[xo][yo]);
            }
            origBounds[2] += direction;
            origBounds[0] -= 1;
            origBounds[1] += 1;
        } else {
            let xo = origBounds[1];
            for (let yo = origBounds[2]; yo <= origBounds[3]; yo++) {
                //console.log('VISION '+ i, map[xo][yo].biome);
                vision[i].push(map[xo][yo]);
            }
            origBounds[1] += direction;
            origBounds[2] -= 1;
            origBounds[3] += 1;
        }
    }

    return vision;

}

function renderVision(vision, coord, players, loots) {
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
            const row = x.map(y => renderTile(y, players, loots)).join('');
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
            const row = x.map(y => renderTile(y, players, loots));
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

function renderMap(map, players, loots, showCities) {
    // primeiro eu tento diminuir uma escada do mapa, pra ele ficar pela metade
    function compareTiles(tile1, tile2) {
        if ((players && getPlayerFromTile(tile2, players)) || (loots && getLootFromTile(tile2, loots))) {
            return tile2;
        } else if ((tile2.walkable && !tile1.walkable) || tile2.city) {
            return tile2;
        } else if (tile2.biome !== 'BEACH' && tile2.biome !== 'OCEAN') {
            return tile2;
        }

        return tile1;
    }

    let newMap = [];
    for (let x = 0; x < map.length; x+=2) {
        newMap[x/2] = [];
        for (let y = 0; y < map[x].length; y+=2) {
            newMap[x/2][y/2] = compareTiles(compareTiles(map[x][y], map[x][y+1]), compareTiles(map[x+1][y], map[x+1][y+1]));
        }
    }

    let textMap = [""], textIdx = 0;
    let obs = [], obsIdx = 1;
    newMap.map(ax => {
        let y = 0;
        let textRow = [];
        while (y < ax.length) {
            const tile = ax[y];

            textRow.push(renderTile(tile, players, loots));

            if (showCities && tile.city) {
                // tira o ultimo inserido
                textRow.pop();

                // insere um numero no lugar
                textRow.push('`[' + obsIdx + ']`');
                obs.push('`[' + obsIdx + ']` **' + tile.city.name + '** (área: ' + distanceName(tile.city.radius * 2) + '²)');
                obsIdx++;
            }

            y++;
        }
        textRow = textRow.join("");
        if (textMap[textIdx].length + textRow.length > 1800) {
            textIdx++;
            textMap[textIdx] = "";
        }
        textMap[textIdx] += textRow + "\n";
    });

    if (obs.length) {
        textMap[++textIdx] = obs.join("\n");
    }

    return textMap;
}

// transforma a sintaxe 2s 1l 3n em ['s', 's', 'l', 'n', 'n', 'n']
function walkSyntaxToWalks(syntax) {
    const parts = syntax.split(/\s+/);
    let walks = [];
    parts.forEach(part => {
        const matchs = part.match(/^(\d+)([a-z]+)$/);
        let [, steps, coord] = matchs;

        steps = Math.max(0, steps);
        coord = normalizeCoord(coord);
        while (coord && steps--) {
            // adiciona no array quantas vezes tiver step
            walks.push(coord);
        }
    });

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

module.exports = BattleRoyale;