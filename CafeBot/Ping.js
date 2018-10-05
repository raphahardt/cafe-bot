const PermissionError = require('./Errors/PermissionError');

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

    argsCommand(message, args) {
        const argsList = args.map(n => `:small_blue_diamond: ${n}`).join("\n");
        return message.reply(`Argumentos (**${args.length}**):\n${argsList}`)
    }

    idsCommand(message, args) {
        let members = [];

        if (args.includes('admins')) {
            let admins = [];
            adminsIds.forEach(id => {
                admins.push(message.guild.members.get(id));
            });

            members = members.concat(admins);

            args.splice(args.indexOf('admins'), 1);
        }

        members = members.concat(utils.resolveAllMentioned(message, args, true));

        members = utils.uniqueArray(members);

        if (members.length === 0) {
            return message.reply(`:x: Nenhum membro encontrado.`);
        }

        const membersList = members.map(n => `:small_blue_diamond: ${n.user.username}: **${n.user.id}**`).join("\n");
        return message.reply(`IDs dos membros:\n${membersList}`);
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