
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
    }

};

module.exports = utils;