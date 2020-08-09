
/**
 * TODO: descricao
 *
 */
module.exports = class ComoVaiSerAlgoInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/como.*?vai.*?(ser)?.*$/i);
    }

    static get priority() { return 0 };

    static phrases(user, questionPhrase, mentions) {
        return [
            'vai ser ruim',
            'pessimo',
            'sera uma bosta',
            'nao vai dar certo',
            'talvez de bom',
            'vai dar certo',
            'certo',
            'nilton',
            'facepalm',
            'topper',
            'top',
            'vai ser 100'
        ];
    }
};
