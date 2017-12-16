
/**
 * Se a pergunta for algo tipo "eu sou bonito/lindo?",
 * esse interpreter vai responder com "levei um tiro aki".
 *
 */
module.exports = class LeveiUmTiroInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/((eu )?sou|me).*?(bonit|lind)/g);
    }

    static get priority() { return 0 };

    static phrases(user, mentions) {
        return ['levei um tiro aki'];
    }
};
