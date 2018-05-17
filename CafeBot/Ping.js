
const utils = require('../utils');
const adminsIds = require('../adminIds');

class Ping {
    constructor () {}

    static get name() { return 'ping' }

    static pingCommand(message, args) {
        message.channel.send("Ping?")
            .then(m => {
                const client = message.client;
                m.edit(`**Pong!** Latência: ${m.createdTimestamp - message.createdTimestamp}ms. Ping da API: ${Math.round(client.ping)}ms`);
            })
            .catch(console.error);
    }

    static argsCommand(message, args) {
        const argsList = args.map(n => `:small_blue_diamond: ${n}`).join("\n");
        message.channel.send(`Argumentos (**${args.length}**):
${argsList}`)
    }

    static idsCommand(message, args) {
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

        const membersList = members.map(n => `:small_blue_diamond: ${n.user.username}: **${n.user.id}**`).join("\n");
        if (members.length === 0) {
            message.channel.send(`:x: Nenhum membro encontrado.`);
            return;
        }
        message.channel.send(`IDs dos membros:\n${membersList}`);
    }

    static commands() {
        return {
            //'ping': Ping.pingCommand,
            //'args': Ping.argsCommand,
            'ids': Ping.idsCommand
        }
    }
}

module.exports = Ping;