
/**
 * Esse interpreter vai responder com respostas aleatórias
 * a qualquer pergunta feita.
 * É o interpreter "coringa", que responde se nenhum outro interpreter
 * quiser responder a pergunta.
 *
 */
module.exports = class RandomInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return true;
    }

    static get priority() { return -512 };

    static phrases(user, mentions) {
        return [
            'nao',
            'sim',
            'nem fodendo',
            'obvio',
            'nao sei',
            'ata'
        ];
    }
};
