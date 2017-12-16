
module.exports = class RandomInterpreter {
    constructor() {}

    static interpret(user, questionPhrase) {
        return true;
    }

    static get priority() { return -512 };

    static phrases() {
        return [
            '*apertad4*',
            'dormiu',
            'bucetao',
            'nilton',
            'meme'
        ];
    }
};
