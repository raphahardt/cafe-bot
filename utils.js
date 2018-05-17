const levenshtein = require('fast-levenshtein');

const utils = {

    /**
     * O prefixo dos comandos do bot.
     *
     * @type {String}
     */
    prefix: '+',

    /**
     * Retorna true se o usuário for um bot.
     * Essa função é útil pra excluir bots de alguns eventos e comandos, senão
     * pode dar o possível 'botception'
     *
     * @param {Discord.GuildMember} member O membro a ser verificado se é bot
     * @returns {boolean}
     */
    verifyUserIsBot: member => {
        // mudei pra essa verificação, pq verificar pela role abre brecha pra alguém
        // se colocar como bot e ser ignorado pelo cafe-bot.
        return (!member || member.user.bot);
        // a verificação antiga ->
        //return member.roles.some(r => ["bot"].includes(r.name));
    },

    /**
     * Embaralha um array
     *
     * visto em:
     * https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
     *
     * @param {Array} array
     * @param {number} seed Um seed para viciar o embaralhamento
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

        if (message.mentions.members.size > 0) {
            const members = message.mentions.members.array();

            mentionedMembers = mentionedMembers.concat(members);

            if (clearMentionedUsersFromArgs) {
                // tira eles da lista de argumentos
                members.forEach(member => {
                    args.splice(args.indexOf('<@!'+member.id+'>'), 1);
                });
            }
        }

        if (args.length > 0) {
            let foundMembers = [], foundMembersTexts = [];

            args.forEach(arg => {
                if (arg.match(/^=?[0-9]+$/) && arg.length >= 10) {
                    // se encontrar um id numerico
                    const text = arg.replace(/^=/, '');

                    foundMembers.push(message.guild.members.get(text));
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
                            if (lev <= 3) {
                                console.log('LEVEN', lev, text, username);
                                console.log('LEVEN RATIO', (lev <= text.length / 3));
                            }
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

    }

};

module.exports = utils;