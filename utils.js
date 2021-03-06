const levenshtein = require("fast-levenshtein");

const PermissionError = require('./CafeBot/Errors/PermissionError');
const LongMessage = require('./CafeBot/Util/LongMessage');
const MessageIdResolvable = require('./CafeBot/Util/MessageIdResolvable');
const InteractivePrompt = require('./CafeBot/Util/InteractivePrompt');

const utils = {

    /**
     * O prefixo dos comandos do bot.
     *
     * @type {String}
     */
    prefix: process.env.DISCORD_PREFIX,

    /**
     * Embaralha um array
     *
     * visto em:
     * https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
     *
     * @param {Array} array
     * @param {number} [seed] Um seed para viciar o embaralhamento
     * @return {Array}
     */
    shuffle: (array, seed) => {
        let currentIndex = array.length, temporaryValue, randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            const random = seed === undefined ? Math.random() : utils.seededRandom(seed++);
            randomIndex = Math.floor(random * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }

        return array;
    },

    /**
     * Math.random(), só que viciado.
     *
     * solução dada em:
     * https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
     * Eu só modifiquei a função pra ela aceitar um seed via argumento em vez de gerar um número
     * fixo a cada call.
     *
     * @param {number} seed
     * @return {number}
     */
    seededRandom: seed => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    },

    /**
     * Função pra pegar todos os matchs de uma string.
     *
     * solução dada em:
     * http://cwestblog.com/2013/02/26/javascript-string-prototype-matchall/
     * Eu só modifiquei pra ser usado num contexto do utils.js, em vez de hookar
     * o próprio objeto String como o post sugere.
     *
     * @param string
     * @param regexp
     * @return {*}
     */
    matchAll: (string, regexp) => {
        let matches = [];
        string.replace(regexp, function() {
            let arr = ([]).slice.call(arguments, 0);
            let extras = arr.splice(-2);
            arr.index = extras[0];
            arr.input = extras[1];
            matches.push(arr);
        });
        return matches.length ? matches : null;
    },

    uniqueArray: (array) => {
        return array.filter((item, pos) => array.indexOf(item) === pos);
    },

    /**
     * Pega todas as pessoas que foram mencionadas da mensagem e/ou dos argumentos.
     * Usa levenshtein pra tentar aproximar do nome do usuário, em caso de argumentos.
     * Se o argumento começar com '=', ele sempre vai ser tratado como menção e o levenshtein
     * vai tentar identificar qual foi.
     *
     * @param {Message} message
     * @param {Array} args Argumentos passados no comando que podem ser menções
     * @param {Boolean} allArgsAreMembers Se todos os argumentos devem ser tratados como menções ou necessita do prefixo '=' pra identificar um possivel membro. Por exemplo, se os args vem ['=raphadura', '=dani', 'adicionar'], caso `allArgsAreMembers` for TRUE, os 3 argumentos vão ser testados se são menções. Caso for FALSE, somente os 2 primeiros argumentos serão testados, o último será ignorado. Padrão: FALSE
     * @param {Boolean} clearMentionedUsersFromArgs Se os args retornados conterão os mencionados ou não. Padrão: TRUE
     *
     * @return {Array} Retorna os usuários mencionados
     */
    resolveAllMentioned: (message, args, allArgsAreMembers, clearMentionedUsersFromArgs) => {
        if (allArgsAreMembers === undefined) allArgsAreMembers = false;
        if (clearMentionedUsersFromArgs === undefined) clearMentionedUsersFromArgs = true;

        let mentionedMembers = [];

        if (message.mentions && message.mentions.members && message.mentions.members.size > 0) {
            const members = message.mentions.members.array();

            mentionedMembers = mentionedMembers.concat(members);

            if (clearMentionedUsersFromArgs) {
                // tira eles da lista de argumentos
                members.forEach(member => {
                    args.splice(args.indexOf("<@!"+member.id+">"), 1);
                });
            }
        }

        if (args.length > 0) {
            let foundMembers = [], foundMembersTexts = [];

            args.forEach(arg => {
                if (arg.match(/^=?[0-9]+$/) && arg.length >= 10) {
                    // se encontrar um id numerico
                    const text = arg.replace(/^=/, "");

                    foundMembers.push(message.guild.members.cache.get(text));
                    foundMembersTexts.push(arg);

                } else if (allArgsAreMembers || arg.charAt(0) === '=') {
                    let alternative, shortest;
                    alternative = shortest = null;
                    const text = arg.replace(/^=/, '').toLowerCase();

                    for (let i = 0; i < message.guild.members.size; i++) {
                        const guildMember = message.guild.members.array()[i];
                        let usernames = [guildMember.user.username.toLowerCase()];
                        if (guildMember.nickname) {
                            usernames.push(guildMember.nickname.toLowerCase());
                        }
                        for (let j = 0; j < usernames.length; j++) {
                            const username = usernames[j];

                            // se o nome parcial já for parte do nick, retorna
                            if (text.length >= 3 && username.indexOf(text) === 0) {
                                alternative = guildMember;
                                break;
                            }

                            const lev = levenshtein.get(text, username, { useCollator: true });
                            // if (lev <= 3) {
                            //     console.log('LEVEN', lev, text, username);
                            //     console.log('LEVEN RATIO', (lev <= text.length / 3));
                            // }
                            if (lev <= text.length / 3 && (null === alternative || lev < shortest)) {
                                alternative = guildMember;
                                shortest = lev;
                            }
                        }
                    }

                    if (alternative) {
                        foundMembers.push(alternative);
                        foundMembersTexts.push(arg);
                    }
                }
            });

            if (clearMentionedUsersFromArgs && foundMembersTexts.length) {
                // tira eles da lista de argumentos
                foundMembersTexts.forEach(text => {
                    args.splice(args.indexOf(text), 1);
                });
            }

            mentionedMembers = mentionedMembers.concat(foundMembers);

        }

        return utils.uniqueArray(mentionedMembers);

    },

    /**
     *
     * @param message
     * @return {LongMessage}
     */
    longMessage(message) {
        return new LongMessage(message.channel, message.author);
    },

    /**
     *
     * @param message
     * @param args
     * @param clearFromArgs
     * @return {MessageIdResolvable}
     */
    messageResolver(message, args, clearFromArgs) {
        return new MessageIdResolvable(message, args, clearFromArgs);
    },

    /**
     *
     * @param module
     * @param message
     * @param title
     * @param timeout
     * @return {InteractivePrompt}
     */
    prompt(module, message, title, timeout) {
        return new InteractivePrompt(message.channel, message.author, title, timeout);
    },

    /**
     * Manda uma mensagem maior do que 2000 caracteres.
     * Se passou dos 2000, ele separa em duas msgs.
     * Ele é inteligente o suficiente pra não separar metades de frases.
     *
     * @param channel
     * @param longContent
     */
    sendLongMessage(channel, longContent) {
        const MAX_MESSAGE_LENGTH = 1970; // faixa de 30 caracteres pra menos só pra garantir

        // se nem passa dos 2000 caracteres, nao tem nem pq fazer tudo isso
        if (longContent.length <= MAX_MESSAGE_LENGTH) {
            return channel.send(longContent);
        }

        // ...agora se passa dos 2000 caracteres, vamos ter q dividir o
        // texto em chunks inteligentes
        function* generateChunks(text, separators) {
            if (!separators.length) {
                // entao infelizmente separa POR caractere
                let chunks = text.match(new RegExp('.{1,' + MAX_MESSAGE_LENGTH + '}', 'g'));
                for (let k = 0; k < chunks.length; k++) {
                    yield chunks[k];
                }
            } else {
                let separator = separators.shift();
                if (!(text.indexOf(separator) >= 0)) {
                    // se nao tem o simbolo, tenta com o proximo
                    yield* generateChunks(text, separators);
                } else {
                    // se tem, tenta separar
                    let arrayText = text.split(separator).map(t => t + separator);
                    let textRow = "";
                    for (let i = 0; i < arrayText.length; i++) {
                        const row = arrayText[i];
                        if (row.length > MAX_MESSAGE_LENGTH) {
                            // se mesmo assim a msg ta grande, tenta com o proximo
                            yield* generateChunks(row, separators);
                        } else {
                            if (textRow.length + row.length > MAX_MESSAGE_LENGTH) {
                                yield textRow;
                                textRow = "";
                            }
                            textRow += row;
                        }
                    }
                    // o que sobrou do ultimo chunk de row
                    if (textRow) yield textRow;
                }
            }
        }

        // let iterableChunks = {};
        // iterableChunks[Symbol.iterator] = function* () {
        //     if (!longContent.match(/\n/)) {
        //
        //     } else {
        //
        //     }
        //     let longArrayRows = longContent.split(/\n/).map(t => t + "\n");
        //     let textRow = "";
        //     for (let i = 0; i < longArrayRows.length; i++) {
        //         const row = longArrayRows[i];
        //         // primeiro verifica se a propria linha não tem mais de 2000 caracteres
        //         if (row.length > MAX_MESSAGE_LENGTH) {
        //             // se tiver, separa por espaços
        //             let longArrayColumns = row.split(/ /).map(t => t + " ");
        //             let textColumn = "";
        //             for (let j = 0; j < longArrayColumns.length; i++) {
        //                 const column = longArrayColumns[j];
        //                 // se ainda assim, o pedaço da coluna for maior que 2000...
        //                 if (column.length > MAX_MESSAGE_LENGTH) {
        //                     // entao infelizmente separa POR caractere
        //                     let chunks = column.match(new RegExp('.{1,' + MAX_MESSAGE_LENGTH + '}', 'g'));
        //                     for (let k = 0; k < chunks.length; k++) {
        //                         yield chunks[k];
        //                     }
        //                 } else {
        //                     if (textColumn.length + column.length > MAX_MESSAGE_LENGTH) {
        //                         yield textColumn;
        //                         textColumn = "";
        //                     }
        //                     textColumn += column;
        //                 }
        //             }
        //             // o que sobrou do ultimo chunk de column
        //             if (textColumn) yield textColumn;
        //         } else {
        //             if (textRow.length + row.length > MAX_MESSAGE_LENGTH) {
        //                 yield textRow;
        //                 textRow = "";
        //             }
        //             textRow += row;
        //         }
        //     }
        //     // o que sobrou do ultimo chunk de row
        //     if (textRow) yield textRow;
        // };

        let generator = generateChunks(longContent, ["\n", " "]);
        let msgPromises = [], content = [];
        let chunk;
        while (chunk = generator.next()) {
            if (chunk.done) {
                break;
            }
            content.push(chunk.value);
            msgPromises.push(channel.send("**...**"));
        }
        // for (let chunk of iterableChunks) {
        //     content.push(chunk);
        //     msgPromises.push(channel.send("**...**"));
        // }

        // manda a mensagem de quantas msgs vao ser e envia uma a uma
        return Promise.all(msgPromises).then((msgs) => {
            let editsPromises = [];
            for (let m = 0; m < msgs.length; m++) {
                editsPromises.push(msgs[m].edit(content[m]));
            }

            return Promise.all(editsPromises);
        });
    },

    hasPermission: (message, type = 'MODERATORS') => {
        if (type === 'MASTER') {
            return message.author.id === '208028185584074763';
        }
        return false;
    },

    /**
     *
     * @param {string} command
     * @param {string} args
     * @returns {string}
     */
    printCommand: (command, ...args) => {
        return `\`${utils.prefix}${command} ${args.join(' ')}\``;
    },

};

module.exports = utils;
