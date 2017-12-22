
/**
 * Fala a palavra que a pessoa pediu.
 * Só aceita no máximo 3 palavras, e o total de caracteres tem que ser até 25.
 * Esses limites são pra não quebrar o bot.
 *
 */
module.exports = class PalavraInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/^(\w+\s?){1,3}$/gi) && questionPhrase.length <= 25;
    }

    static get priority() { return 5 };

    static phrases(user, questionPhrase, mentions) {
        return [questionPhrase.toString().toLowerCase()];
    }
};
