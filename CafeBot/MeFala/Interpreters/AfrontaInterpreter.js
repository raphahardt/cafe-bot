
/**
 * TODO: descricao
 *
 */
module.exports = class AfrontaInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/((eu )?te odeio|bot fodid[oa])/i);
    }

    static get priority() { return 0 };

    static phrases(user, questionPhrase, mentions) {
        return [
            'q afronta',
            'pisa mais',
            'vsf',
            'vtnc',
            'mas eu te amo'
        ];
    }
};
