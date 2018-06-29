
const utils = require('../utils');
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

    static messageTestCommand(message, args) {
        let counter = 1;
        let m = '';
        // deixa tudo como numero
        args = args.map(a => Math.min(9999, parseInt(a)));

        m = 'a'.repeat((args[0] || 1));
        //m = m.match(/.{1,200}/gm).map(t => t + "" + counter++).join("");
        if (args[2]) m = m.match(new RegExp('.{1,' + args[2] + '}', 'gm')).join(" ");
        if (args[1]) m = m.match(new RegExp('.{1,' + args[1] + '}', 'gm')).join("\n");

        utils.sendLongMessage(message.channel, m);
    }

    static commands() {
        return {
            'count': Counter.countCommand,
            'msgtest': Counter.messageTestCommand
        }
    }
}

module.exports = Counter;