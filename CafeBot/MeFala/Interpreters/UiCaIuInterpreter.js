
/**
 * TODO: descricao
 *
 */
module.exports = class UiCaIuInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/\b(yamete|iu ca\s?iu|ui)\b/i);
    }

    static get priority() { return 0 };

    static phrases(user, questionPhrase, mentions) {
        return ['iucaiv'];
    }
};
