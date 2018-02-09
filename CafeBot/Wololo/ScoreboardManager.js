
module.exports = class ScoreboardManager {
    constructor (channel) {
        this.channel = channel;
        this.messages = [];
    }

    handle(content) {
        return new Promise((resolve, reject) => {
            if (this.messages.length === 0) {
                this.channel.send('Carregando placar...').then(msg => {
                    this.messages.push(msg);

                    return msg.edit('');
                }).then(() => {
                    return this.channel.send('Carregando placar...');
                }).then(msg2 => {
                    this.messages.push(msg2);

                    return msg2.edit('');
                }).then(() => {
                    resolve();
                });
            } else {
                resolve();
            }
        }).then(() => {
            // agora tem 2 mensagems pra serem usadas, só editar
            return this.messages[0].edit(content);
        })
    }

};