
const utils = require('../../../utils');

/**
 * TODO: descricao
 *
 */
module.exports = class QuantosInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/(com )?(quant[oa]s?|qt[oa]s?) ([^ ]+)/i);
    }

    static get priority() { return 5 };

    static phrases(user, questionPhrase, mentions) {
        // função auxiliar pra transformar uma string em numeros
        function _chars(str) {
            let n = 0;
            for (let i = 0; i < str.length; i++) {
                n += str.charCodeAt(i);
            }
            return n;
        }

        const thing = questionPhrase.match(/(?:quant[oa]s?|qt[oa]s?) ([^?]+)/i);
        const seed = _chars(thing[1]);

        let max = 30;
        switch (true) {
            case thing[1].substr(0, 4) === 'anos': max = 90; break;
            // TODO: adicionar mais suposições aqui
        }

        return [
            "" + parseInt(utils.seededRandom(seed) * max)
        ];
    }
};
