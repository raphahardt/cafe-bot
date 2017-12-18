
const utils = require('../../../utils');

/**
 * TODO: descricao
 *
 */
module.exports = class MegaSenaInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/mega ?sena/i);
    }

    static get priority() { return 0 };

    static phrases(user, mentions) {
        const today = new Date();
        const seed = today.getDate() + today.getMonth() + today.getFullYear();
        let numeros = utils.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], seed);
        numeros = numeros.splice(0, 6).join(' ');

        return [numeros];
    }
};
