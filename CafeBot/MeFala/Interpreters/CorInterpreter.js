
/**
 * TODO: descricao
 *
 */
module.exports = class CorInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/qual\s+(é.+?)?(melhor|best|mais).*?/i) && questionPhrase.match(/\bcor\b/i);
    }

    static get priority() { return 16 };

    static phrases(user, questionPhrase, mentions) {
        return [
            'azul',
            'rosa',
            'amarelo',
            'laranja',
            'cinza',
            'roxo',
            'vermelho',
            'preto',
            'branco',
            'transparente'
        ];
    }
};
