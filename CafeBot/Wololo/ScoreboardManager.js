
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
            let text = '', j = 0;
            for (let i = 0; i < content.length; i++) {
                text += content[i];

                if (text.length >= 1800) {
                    this.messages[j++].edit(text);
                    text = '';
                }
            }
            this.messages[j].edit(text);
        })
    }

};