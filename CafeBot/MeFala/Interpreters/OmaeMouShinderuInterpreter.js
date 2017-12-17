
/**
 * TODO: descricao
 *
 */
module.exports = class OmaeMouShinderuInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/omae a?mou? shin?dei?ru/i);
    }

    static get priority() { return 0 };

    static phrases(user, mentions) {
        return ['nani?'];
    }
};
