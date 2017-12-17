
/**
 * TODO: descricao
 *
 */
module.exports = class SignoInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/(qual )?.*?signo.*?d[oae]/i) || questionPhrase.match(/vai.*?ser.*?signo/i);
    }

    static get priority() { return 10 };

    static phrases(user, mentions) {
        return [
            'aquario',
            'sagitario',
            'escorpiao',
            'peixes',
            'capricornio',
            'leao',
            'gemeos',
            'libra',
            'touro',
            'virgem',
            'aries',
            'cancer'
        ];
    }
};
