
/**
 * TODO: descricao
 *
 */
module.exports = class ComerInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/eu\s+(deveria)?.*?/i)
            && (questionPhrase.match(/\b(comer|jantar|almoçar|café( da manhã)?)\b/i)
            || questionPhrase.match(/n[oa]\b.*?(almoço|janta|café( da manhã)?)\b/i));
    }

    static get priority() { return 16 };

    static phrases(user, questionPhrase, mentions) {
        return [
            'comida'
        ];
    }
};
