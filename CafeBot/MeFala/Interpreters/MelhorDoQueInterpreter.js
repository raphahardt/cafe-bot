
/**
 * TODO: descricao
 *
 */
module.exports = class MelhorDoQueInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/\w\s+é\s+melhor\s+(qu?e?\s+)?\w/i);
    }

    static get priority() { return 0 };

    static phrases(user, mentions) {
        return [
            'um pouco',
            'muito',
            'demais',
            'nope',
            'nao'
        ];
    }
};
