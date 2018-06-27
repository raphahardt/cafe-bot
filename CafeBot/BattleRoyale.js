
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
let MAX_WALKS = 10;
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
                message.reply(`:thumbsup: Você já está no jogo!` + JSON.stringify(player));
            } else {
                channel.send(`:inbox_tray: Usuário ${message.author} entrou no jogo!` + JSON.stringify(player));
                console.log('ENTER', player);
            }

        }).catch(error => {
            message.reply(`:x: ${error}`);
        })
    }

    static royaleStatsCommand(message, args) {}

    static royaleVisionCommand(message, args) {

        getMap().then(map => {
            getPlayer(message.author).then(player => {
                const channel = getRoyaleChannel(message);

                channel.send(`pos: ${player.pos[0]}, ${player.pos[1]}`);

                const vision = calcVision(map, player.pos[0], player.pos[1], args[0], MAX_DISTANCE_OBJECTS_DETECT);

                let textMap = "";
                for (var v = 0; v < MAX_VISION; v++) {
                    const x = vision[v];
                    const row = x.map(y => biomeSymbol(y.biome)).join('');
                    const blanks = (1 + (2 * (MAX_VISION - 1))) - row.length;
                    const midBlank = parseInt(blanks / 2);

                    textMap += (" ".repeat(midBlank)) + row + (" ".repeat(midBlank));
                    textMap += "\n";
                }

                // encontrar proximidades
                let textProx = "";
                let gone = [];
                for (var d = 0; d < MAX_DISTANCE_OBJECTS_DETECT; d++) {
                    for (let i = 0; i < vision[d].length; i++) {
                        const tile = vision[d][i];

                        if (tile.proxCity) {
                            const cityName = map[tile.proxCity.origin[0]][tile.proxCity.origin[1]].city.name;

                            if (!gone.includes(cityName)) {
                                const distance = distanceName(calcDistance(
                                    player.pos[0], player.pos[1],
                                    tile.proxCity.origin[0], tile.proxCity.origin[1]
                                ));

                                textProx += `O local **${cityName}** está ${distance}\n`;

                                gone.push(cityName);
                            }

                        }
                    }
                }

                message.reply(`Visão:\n\`\`\`\n${textMap}\`\`\`\nProximidades:\n${textProx}`);


            }).catch(error => {
                message.reply(`:x: ${error}`);
            });
        }).catch(error => {
            message.reply(`:x: ${error}`);
        })
    }

    static royaleWalkCommand(message, args) {}


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
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    arrayMap[x][y] = Object.assign({}, polygons[0].tile);
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

        let textMap = "";
        arrayMap.map(ax => {
            let y = 0;
            while (y < ax.length) {
                const tile = ax[y];

                if (tile.city) {
                    const nameLength = tile.city.name.length + 2;
                    const negativeDiffCityText = parseInt(nameLength / 2);
                    const positiveDiffCityText = nameLength - negativeDiffCityText;

                    // retira os biomas da metade do texto
                    textMap = textMap.substr(0, textMap.length - negativeDiffCityText);

                    textMap += '[' + tile.city.name + ']';
                    y += positiveDiffCityText;
                    continue;
                }

                textMap += biomeSymbol(tile.biome);
                y++;
            }
            textMap += "\n";
        });

        message.reply(`Mapa:\n\`\`\`\n${textMap}\`\`\``);
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
 * @param biome
 */
function biomeSymbol(biome) {
    if (biome === 'OCEAN') return '~'; //return '▓';
    if (biome === 'BEACH') return '░';
    if (biome === 'TEMPERATE_RAIN_FOREST'
        || biome === 'TEMPERATE_DECIDUOUS_FOREST'
        || biome === 'TROPICAL_RAIN_FOREST'
        || biome === 'TROPICAL_SEASONAL_FOREST') return Math.random() < 0.1 ? '¥' : '▓';
    if (biome === 'LAKE'
        || biome === 'MARSH'
        || biome === 'ICE') return '≡';
    if (biome === 'TEMPERATE_DESERT'
        || biome === 'SUBTROPICAL_DESERT'
        || biome === 'SHRUBLAND') return '▒';
    if (biome === 'GRASSLAND'
        || biome === 'TAIGA') return '▒';
    return biome.substr(0,2);
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

function respawnPlayer(user) {
    return new Promise((resolve, reject) => {
        getPlayer(user).then(player => {
            getRandomWalkableTile().then(tile => {
                // seta novo tile pro player
                player.pos = tile;
                // aumenta uma morte
                player.deaths++;

                ref.child(`player/${user.id}`).set(player);
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

function getRandomWalkableTile(forceX, forceY, tries) {
    return new Promise((resolve, reject) => {
        getMap().then(map => {
            getPlayers().then(players => {
                tries = tries || 200;

                function hasPlayer(x, y) {
                    if (players) {
                        for (let p in players) {
                            if (players[p].pos[0] === x && players[p].pos[1] === y) {
                                return true;
                            }
                        }
                    }
                    return false;
                }

                if (forceX && forceY) {
                    let xa = forceX,
                        ya = forceY;

                    if (map[xa][ya].walkable && !hasPlayer(xa, ya)) {
                        resolve([xa, ya]);
                    } else {
                        reject('Não pode ser colocado neste tile.');
                    }
                } else {
                    while (tries--) {
                        let xa = parseInt(Math.random() * MAP_HEIGHT),
                            ya = parseInt(Math.random() * MAP_WIDTH);

                        if (map[xa][ya].walkable && !hasPlayer(xa, ya)) {
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
    let distanceName = "";
    for (var i = 0; i < distances.length; i++) {
        if (distance >= distances[i].value) {
            distanceName = distances[i].name;
        }
    }
    return distanceName;
}

function calcVision(map, x, y, coord, distanceVision) {
    let vision = [];

    const orientation = ['n', 's'].includes(coord) ? 'v' : 'h';
    const direction = ['n', 'l'].includes(coord) ? -1 : 1;

    let origBounds = [x, x, y, y];
    for (let i = 0; i < distanceVision; i++) {
        vision[i] = [];
        console.log('BOUNDS', origBounds);

        // limitar os bounds pelos edges do mapa
        origBounds[0] = Math.max(Math.min(origBounds[0], MAP_HEIGHT - 1), 0);
        origBounds[1] = Math.max(Math.min(origBounds[1], MAP_HEIGHT - 1), 0);
        origBounds[2] = Math.max(Math.min(origBounds[2], MAP_WIDTH - 1), 0);
        origBounds[3] = Math.max(Math.min(origBounds[3], MAP_WIDTH - 1), 0);

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

module.exports = BattleRoyale;