
/**
 * TODO: descricao
 *
 */
module.exports = class MegaSenaInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/mega sena/i);
    }

    static get priority() { return 0 };

    static phrases(user, mentions) {
        let numeros = '';
        for (let i = 0; i < 6; i++) {
            numeros += parseInt(Math.random() * 9 + 1);
        }
        return [numeros];
    }
};
