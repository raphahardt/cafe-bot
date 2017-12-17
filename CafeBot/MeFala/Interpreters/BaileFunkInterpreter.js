
/**
 * TODO: descricao
 *
 */
module.exports = class BaileFunkInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/(baile )?funk\b/i);
    }

    static get priority() { return 0 };

    static phrases(user, mentions) {
        if (user.username === 'Nemie' || mentions.members.exists('username', 'Nemie')) {
            return ['so vai nemi', 'senta nemi'];
        }
        return [
            'senta',
            'tiro porrada bomba',
            'ate o chao',
            'quica',
            'senta muito'
        ];
    }
};
