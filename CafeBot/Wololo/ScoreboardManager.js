
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
                const nextTextLength = text.length + (content[i+1] ? content[i+1].length : 0);

                if (nextTextLength >= 1950) {
                    this.messages[j++].edit(text);
                    text = '';
                }
            }
            this.messages[j].edit(text);
        })
    }

};