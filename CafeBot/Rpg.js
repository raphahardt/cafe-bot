
class Rpg {
    constructor () {}

    static get modName() { return 'rpg' }

    static pingCommand(message, args) {
        message.channel.send("Ping?")
            .then(m => {
                const client = message.client;
                m.edit(`**Pong!** Latência: ${m.createdTimestamp - message.createdTimestamp}ms. Ping da API: ${Math.round(client.ping)}ms`);
            })
            .catch(console.error);
    }

    static commands() {
        return {
            'ping': Rpg.pingCommand
        }
    }
}

module.exports = Rpg;