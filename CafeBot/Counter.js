
let insideCount = {};

class Counter {
    constructor () {}

    static get name() { return 'counter' }

    static countCommand(message, args) {
        if (!insideCount[message.author.id]) {
            insideCount[message.author.id] = 0;
        }

        insideCount[message.author.id]++;

        message.channel.send(insideCount[message.author.id]);
    }

    static commands() {
        return {
            'count': Counter.countCommand
        }
    }
}

module.exports = Counter;