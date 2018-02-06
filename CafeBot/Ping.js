
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

    static commands() {
        return {
            'ping': Ping.pingCommand,
            'args': Ping.argsCommand
        }
    }
}

module.exports = Ping;