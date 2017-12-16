
module.exports = class LeveiUmTiroInterpreter {
    constructor() {}

    static interpret(user, questionPhrase) {
        return questionPhrase.match(/((eu )?sou|me).*?(bonit|lind)/g);
    }

    static get priority() { return 0 };

    static phrases() {
        return ['levei um tiro aki'];
    }
};
