
/**
 * TODO: descricao
 *
 */
module.exports = class FelinosInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/(ozzy|joaquim)/i);
    }

    static get priority() { return 0 };

    static phrases(user, questionPhrase, mentions) {
        return ['gato'];
    }
};
