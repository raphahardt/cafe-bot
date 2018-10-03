
const utils = require('../utils');
let insideCount = {};

const Cafebase = require('./Cafebase');
const InterativePrompt = require('./Util/InterativePrompt');

// cache da ultima vez q foi usado um comando, pra evitar spam de comandos
let LAST_USED = {};

class Counter {
    constructor () {
        this.db = new Cafebase('teste');
    }

    get modName() { return 'counter' }

    countCommand(message, args) {
        const now = new Date();
        if (LAST_USED[message.author.id]) {
            console.log('LAST', now.getTime() - LAST_USED[message.author.id]);
            if (now.getTime() - LAST_USED[message.author.id] < 3000) {
                return message.reply(`:x: Aguarde 3 segundos entre um comando e outro...`).then(m => m.delete(3000));
            }
        }
        LAST_USED[message.author.id] = now.getTime();

        if (!insideCount[message.author.id]) {
            insideCount[message.author.id] = 0;
        }

        insideCount[message.author.id]++;

        return message.channel.send(insideCount[message.author.id]);
    }

    messageTestCommand(message, args) {
        let counter = 1;
        let m = '';
        // deixa tudo como numero
        args = args.map(a => Math.min(9999, parseInt(a)));

        m = 'a'.repeat((args[0] || 1));
        //m = m.match(/.{1,200}/gm).map(t => t + "" + counter++).join("");
        if (args[2]) m = m.match(new RegExp('.{1,' + args[2] + '}', 'gm')).join(" ");
        if (args[1]) m = m.match(new RegExp('.{1,' + args[1] + '}', 'gm')).join("\n");

        return utils.sendLongMessage(message.channel, m);
    }

    broomCommand(message, args) {
        const days = parseInt(args.shift());
        const kicked = 0;

        return message.reply(`:white_check_mark: ${kicked} membro(s) foram kickados com sucesso.`);
    }

    pageCommand(message, args) {
        const pages = [
            "1\n2\n3\n4\n5\n",
            "6\n7\n8\n9\n10\n",
            "11\n12\n13\n14\n15\n",
            "16\n17"
        ];

        const prompt = InterativePrompt.create(message.channel, message.member, `:game_die: \`+gacha keep\` **Mantendo um item**`, 60000)
            .addPromptPagination(
                'prompt-item',
                `Escolha o item a ser mantido (ou desmantido, caso já esteja):`,
                pages,
                `Digite o número do item`,
                response => {
                    const v = parseInt(response);
                    return v >= 1 && v <= 17;
                },
                (choice, prompt) => {
                    prompt.setChoice('item', parseInt(choice) - 1);
                }
            )
        ;

        return prompt.start('prompt-item')
            .then(selected => {
                message.reply(selected.item);
            })
        ;
    }

    dbTestCommand(message, args) {
        const action = args.shift();

        switch (action) {
            case 'list':
                this.db.getArray(args[0]).then(list => {
                    const text = list.map(i => `> ${JSON.stringify(i)}`).join("\n");
                    message.reply(text);
                }).catch(err => {
                    console.error(err);
                    message.reply(`:x: ${err}`);
                });
                break;
            case 'find':
                this.db.findAll(args[0], f => f.name === args[1]).then(found => {
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
                this.db.findOne(args[0], f => f.name === args[1]).then(found => {
                    return found;
                }).then(found => {
                    message.reply(JSON.stringify(found));
                }).catch(err => {
                    console.error(err);
                    message.reply(`:x: ${err}`);
                });
                break;
            case 'insert':
                this.db.insert(args[0], { name: args[1] }).then(inserted => {
                    return this.db.getArray(args[0]);
                }).then(list => {
                    const text = list.map(i => `> ${JSON.stringify(i)}`).join("\n");
                    message.reply(text);
                }).catch(err => {
                    console.error(err);
                    message.reply(`:x: ${err}`);
                });
                break;
            case 'clear':
                this.db.save(args[0], null).then(saved => {
                    return this.db.getArray(args[0]);
                }).then(list => {
                    const text = list.map(i => `> ${JSON.stringify(i)}`).join("\n");
                    message.reply(text);
                }).catch(err => {
                    console.error(err);
                    message.reply(`:x: ${err}`);
                });
                break;
        }
    }

    /*async asyncTestCommand(message, args) {
        const text = await asyncFunc(message.client, message.content);

        message.reply(text);
    }*/

    nickCommand(message, args) {
        console.log('+NICK', args[0]);
        message.member.setNickname(args[0]);
    }

    onMemberUpdate(oldMember, newMember) {
        let oldNick = oldMember.nickname || oldMember.user.nickname;
        let newNick = newMember.nickname || newMember.user.nickname;
        console.log('MUDOU NICK', oldNick, newNick);
        if (oldNick !== newNick) {
            newMember.setNickname(oldNick);
        }
    }

    commands() {
        return {
            'count': this.countCommand,
            'page': this.pageCommand,
            //'nick': this.nickCommand,
            'vassoura': this.broomCommand,
            'db': this.dbTestCommand,
            'msgtest': this.messageTestCommand/*,
            'async': this.asyncTestCommand*/
        }
    }

    events() {
        return {
            //'guildMemberUpdate': this.onMemberUpdate
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