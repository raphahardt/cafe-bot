
const letters = require('./letters');

class LetterTransformer {
    constructor() {}

    /**
     *
     * @param {string} phrase
     * @returns {Array}
     */
    static transform(phrase) {
        let transformed = [];
        // cria uma copia do objeto letters, pois vou fazer modificacoes q não
        // pode mexer no objeto original
        let _letters = JSON.parse(JSON.stringify(letters));

        // primeiro eu vou tentar pegar palavras maiores e transformar
        // em emojis que correspondem a ela
        let biggerWords = [];
        for (let l in _letters.words) {
            if (!_letters.words.hasOwnProperty(l)) continue;

            const regexL = new RegExp('' + l + '');
            if (phrase.match(regexL)) {
                // adiciona o emoji num array temporario
                let emoji = _letters.words[l].shift();
                // TODO: tratar quando acabar o "estoque" de emojis
                biggerWords.push(emoji);

                // troco a "palavra" encontrada pelo caracter $, q eu vou
                // usar de coringa pra quando for substituir cada letra
                phrase = phrase.replace(regexL, '$');
            }
        }

        // agora eu passo substituindo letra por letra, das que sobraram
        for (let i = 0; i < phrase.length; i++) {
            let phraseLetter = phrase[i];

            if (phraseLetter === '$') {
                transformed.push(biggerWords.shift());
            } else if (phraseLetter === ' ') {
                // TODO: como fazer com espaço?
            } else if (phraseLetter.length) {
                console.log('letter', phraseLetter);
                let emoji = _letters.single[phraseLetter].shift();
                transformed.push(emoji);
            }
        }

        return transformed;
    }
}

module.exports = LetterTransformer;