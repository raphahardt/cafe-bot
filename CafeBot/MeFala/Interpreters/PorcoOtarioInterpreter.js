
/**
 * TODO: descricao
 *
 */
module.exports = class PorcoOtarioInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/q(ue)? (é|eh?) himedere/i);
    }

    static get priority() { return 30 };

    static phrases(user, questionPhrase, mentions) {
        return ['porco otario'];
    }
};
