
/**
 * TODO: descricao
 *
 */
module.exports = class TudoBemInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/(oi|(td|tudo) b[oe]m)/i);
    }

    static get priority() { return 0 };

    static phrases(user, mentions) {
        if (user.username === 'Polly') {
            return ['oi poli', 'ae poliana'];
        } else if (user.username === 'Be') {
            return ['oi be', 'oi lindo'];
        } else if (user.username === 'Lucas' || user.username === 'Daniagatha' || user.username === 'CrocDeluxe') {
            return ['hello world', 'ola humano'];
        }
        return [
            'ola',
            'joia e vc',
            'blz e tu',
            'de boas',
            'morta e vc',
            'to joia',
            'td tranqs',
            'topzera'
        ];
    }
};
