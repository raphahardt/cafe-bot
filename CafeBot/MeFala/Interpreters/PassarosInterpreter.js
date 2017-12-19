
/**
 * TODO: descricao
 *
 */
module.exports = class PassarosInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/(pur[êe]|nuggets)/i);
    }

    static get priority() { return 0 };

    static phrases(user, questionPhrase, mentions) {
        return ['passaro'];
    }
};
