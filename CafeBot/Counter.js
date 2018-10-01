
const utils = require('../utils');
let insideCount = {};

const Cafebase = require('./Cafebase');
const db = new Cafebase('gacha');
const Gacha = require('./Gacha');

// cache da ultima vez q foi usado um comando, pra evitar spam de comandos
let LAST_USED = {};

class Counter {
    constructor () {}

    static get name() { return 'counter' }

    static countCommand(message, args) {
        const now = new Date();
        if (LAST_USED[message.author.id]) {
            console.log('LAST', now.getTime() - LAST_USED[message.author.id]);
            if (now.getTime() - LAST_USED[message.author.id] < 3000) {
                message.reply(`:x: Aguarde 3 segundos entre um comando e outro...`).then(m => m.delete(3000));
                return;
            }
        }
        LAST_USED[message.author.id] = now.getTime();

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

    static broomCommand(message, args) {
        try {

            const days = parseInt(args.shift());

            message.reply(`:white_check_mark: ${kicked} membro(s) foram kickados com sucesso.`);

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    static dbTestCommand(message, args) {
        try {
            const action = args.shift();

            switch (action) {
                case 'list':
                    db.getArray(args[0]).then(list => {
                        const text = list.map(i => `> ${JSON.stringify(i)}`).join("\n");
                        message.reply(text);
                    }).catch(err => {
                        console.error(err);
                        message.reply(`:x: ${err}`);
                    });
                    break;
                case 'find':
                    db.findAll(args[0], f => f.name === args[1]).then(found => {
                        return found;
                    }).then(list => {
                        const text = list.map(i => `> ${JSON.stringify(i)}`).join("\n");
                        message.reply(text);
                    }).catch(err => {
                        console.error(err);
                        message.reply(`:x: ${err}`);
                    });
                    break;
                case 'findone':
                    db.findOne(args[0], f => f.name === args[1]).then(found => {
                        return found;
                    }).then(found => {
                        message.reply(JSON.stringify(found));
                    }).catch(err => {
                        console.error(err);
                        message.reply(`:x: ${err}`);
                    });
                    break;
                case 'insert':
                    db.insert(args[0], { name: args[1] }).then(inserted => {
                        return db.getArray(args[0]);
                    }).then(list => {
                        const text = list.map(i => `> ${JSON.stringify(i)}`).join("\n");
                        message.reply(text);
                    }).catch(err => {
                        console.error(err);
                        message.reply(`:x: ${err}`);
                    });
                    break;
                case 'clear':
                    db.save(args[0], null).then(saved => {
                        return db.getArray(args[0]);
                    }).then(list => {
                        const text = list.map(i => `> ${JSON.stringify(i)}`).join("\n");
                        message.reply(text);
                    }).catch(err => {
                        console.error(err);
                        message.reply(`:x: ${err}`);
                    });
                    break;
            }

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /*static async asyncTestCommand(message, args) {
        const text = await asyncFunc(message.client, message.content);

        message.reply(text);
    }*/

    static nickCommand(message, args) {
        console.log('+NICK', args[0]);
        message.member.setNickname(args[0]);
    }

    static onMemberUpdate(oldMember, newMember) {
        let oldNick = oldMember.nickname || oldMember.user.nickname;
        let newNick = newMember.nickname || newMember.user.nickname;
        console.log('MUDOU NICK', oldNick, newNick);
        if (oldNick !== newNick) {
            newMember.setNickname(oldNick);
        }
    }

    static commands() {
        return {
            'count': Counter.countCommand,
            'gggd': Gacha.gachaDailyCommand,
            'gggt': Gacha.gachaInfoTokensCommand,
            //'nick': Counter.nickCommand,
            'vassoura': Counter.broomCommand,
            'db': Counter.dbTestCommand,
            'msgtest': Counter.messageTestCommand/*,
            'async': Counter.asyncTestCommand*/
        }
    }

    static events() {
        return {
            //'guildMemberUpdate': Counter.onMemberUpdate
        }
    }
}

// function asyncFunc(client, text) {
//     return new Promise(resolve => {
//         client.setTimeout(function () {
//             resolve(`Teste asyncrono: ${text}`);
//         }, 3000);
//     });
// }

module.exports = Counter;