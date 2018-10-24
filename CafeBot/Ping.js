const PermissionError = require('./Errors/PermissionError');
const LongMessage = require('./Util/LongMessage');

const utils = require('../utils');
const adminsIds = require('../adminIds');

class Ping {
    constructor () {}

    get modName() { return 'ping' }

    async pingCommand(message, args) {
        const m = await message.reply("Ping?");
        m.edit(`${message.author}, **Pong!** Latência: ${m.createdTimestamp - message.createdTimestamp}ms. Ping da API: ${Math.round(message.client.ping)}ms`);
        // return message.reply("Ping?")
        //     .then(m => {
        //         const client = message.client;
        //         m.edit(`${message.author}, **Pong!** Latência: ${m.createdTimestamp - message.createdTimestamp}ms. Ping da API: ${Math.round(client.ping)}ms`);
        //     })
        // ;
    }

    async argsCommand(message, args) {
        console.log(args);
        const argsList = args.map(n => `:small_blue_diamond: ${n}`).join("\n");
        return message.reply(`Argumentos (**${args.length}**):\n${argsList}`);

        // // deixa tudo como numero
        // args = args.map(a => Math.min(9999, parseInt(a)));
        //
        // let counter = 1;
        // let m = 'a'.repeat((args[0] || 1));
        // m = m.match(/.{1,200}/gm).map(t => t + "" + counter++).join("");
        // if (args[2]) m = m.match(new RegExp('.{1,' + args[2] + '}', 'gm')).join(" ");
        // if (args[1]) m = m.match(new RegExp('.{1,' + args[1] + '}', 'gm')).join("\n");
        //
        // counter = 1;
        // let m2 = 'b'.repeat((args[0] || 1) * 2);
        // m2 = m2.match(/.{1,200}/gm).map(t => t + "" + counter++).join("");
        // if (args[2]) m2 = m2.match(new RegExp('.{1,' + args[2] + '}', 'gm')).join(" ");
        // if (args[1]) m2 = m2.match(new RegExp('.{1,' + args[1] + '}', 'gm')).join("\n");
        //
        // const longMessage = utils.longMessage(message);
        //
        // await longMessage.reply(m);
        // message.client.setTimeout(async () => {
        //     await longMessage.edit(m2);
        //     message.client.setTimeout(async () => {
        //         await longMessage.edit('oi');
        //         message.client.setTimeout(async () => {
        //             await longMessage.delete(2000);
        //         }, 3000);
        //     }, 6000);
        // }, 3000);
        //await longMessage.delete(6000);

    }

    async idsCommand(message, args) {
        let ids = await utils.messageResolver(message, args, true).resolveAll(true);

        if (ids.length === 0) {
            return message.reply(`:x: Nenhum elemento encontrado.`);
        }

        const text = ids.map(n => `:small_blue_diamond: ${n}: **${n.id}**`).join("\n");
        const textNotFound = args.map(n => `:small_orange_diamond: ${n}`).join("\n");
        return utils.longMessage(message).reply(`IDs dos membros:\n${text}` + (textNotFound ? `\nArgs não encontrados:\n${textNotFound}` : ''));
    }

    commands() {
        return {
            'ping': this.pingCommand,
            'args': this.argsCommand,
            'ids': this.idsCommand
        }
    }
}

module.exports = Ping;