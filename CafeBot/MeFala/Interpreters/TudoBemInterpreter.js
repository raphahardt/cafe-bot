
/**
 * TODO: descricao
 *
 */
module.exports = class TudoBemInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/(\boi\b|(td|tudo) b[oe]m)/i);
    }

    static get priority() { return 0 };

    static phrases(user, questionPhrase, mentions) {
        return [
            'ola',
            'joia e vc',
            'blz e tu',
            'de boas',
            'to joia'
        ];
    }
};
