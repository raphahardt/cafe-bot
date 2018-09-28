
const Discord = require("discord.js");

class InterativePrompt {
    constructor(channel, title, timeout) {
        this.channel = channel;
        this.title = title;
        this.timeout = timeout;
        this.choices = {};
        this.prompts = {};
        this.next = null;
    }

    static create(channel, title, timeout) {
        return new InterativePrompt(channel, title, timeout);
    }

    setChoice(key, value) {
        this.choices[key] = value;
        return this;
    }

    getChoice(key) {
        return this.choices[key];
    }

    setNext(id) {
        this.next = id;
        return this;
    }

    addPrompt(id, description, footer, filterResponses, cbChoice) {
        this.prompts[id] = {
            id,
            description,
            footer,
            filter: filterResponses,
            callback: cbChoice
        };
        return this;
    }

    start(id) {
        const that = this;
        this.choices = {};
        this.next = id;
        let oldMsg;
        return new Promise((resolve, reject) => {
            let prom = Promise.resolve();

            const _insert = (promise) => {
                return promise.then(() => {
                    if (!this.next) {
                        reject(new Error('Não foi definido um entry point para os prompts.'));
                        return;
                    }
                    console.log('ASK', this.next);
                    const prompt = this.prompts[this.next];
                    if (!prompt) {
                        reject(new Error('Id de prompt `' + this.next + '` não existe.'));
                        return;
                    }
                    return this.channel.send(`${this.title}\n\n${prompt.description}\n\n${prompt.footer} ou \`cancel\` para cancelar.`);
                }).then(msg => {
                    if (msg) {
                        oldMsg = msg;
                        return this.channel.awaitMessages(m => {
                            if (m.content === 'cancel') {
                                return true;
                            }
                            const prompt = this.prompts[this.next];
                            if (!prompt) {
                                reject(new Error('Id de prompt `' + this.next + '` não existe.'));
                                return;
                            }
                            return prompt.filter.apply(null, [m.content, that]);
                        }, {
                            max: 1,
                            time: this.timeout,
                            errors: ['time']
                        })
                    }
                }).then(collected => {
                    if (collected) {
                        if (oldMsg) {
                            oldMsg.delete();
                            oldMsg = null;
                        }
                        const response = collected.first().content;
                        console.log('RESPONSE', this.next, response);

                        if (response === 'cancel') {
                            return Promise.reject(collected);
                        }
                        const prompt = this.prompts[this.next];
                        if (!prompt) {
                            reject(new Error('Id de prompt `' + this.next + '` não existe.'));
                            return;
                        }
                        // limpa o next antes de executar o callback.
                        // o callback vai definir um, ou não.
                        // se não definir, vai finalizar
                        this.next = null;

                        const cbReturn = prompt.callback.apply(null, [response, that]);

                        // recursivamente chama o proximo prompt
                        if (this.next) {
                            return _insert(promise);
                        } else {
                            resolve(this.choices);
                        }
                    }
                })
                ;
            };

            _insert(prom).catch(error => {
                if (oldMsg) {
                    oldMsg.delete();
                    oldMsg = null;
                }
                if (error instanceof Map) {
                    if (error.size === 0) {
                        this.channel.send(`:x: Tempo expirado.`);
                    } else {
                        this.channel.send(`:x: Cancelado.`);
                    }
                } else {
                    reject(error);
                }
            });
        });
    }
}

module.exports = InterativePrompt;