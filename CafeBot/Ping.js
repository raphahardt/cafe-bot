const PermissionError = require('./Errors/PermissionError');
const LongMessage = require('./Util/LongMessage');

const utils = require('../utils');
const adminsIds = require('../adminIds');

class Ping {
    constructor () {}

    get modName() { return 'ping' }

    async pingCommand(message, args) {
        const lm = utils.longMessage(message);
        await lm.reply("Ping?");
        return lm.editReply(`**Pong!** `
            + `Latência: ${lm.message.createdTimestamp - message.createdTimestamp}ms. `);
    }

    async argsCommand(message, args) {
        console.log(args);
        const argsList = args.map(n => `:small_blue_diamond: ${n}`).join("\n");
        return message.reply(`Argumentos (**${args.length}**):\n${argsList}`);
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
