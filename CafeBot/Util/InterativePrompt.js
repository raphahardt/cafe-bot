
const Discord = require("discord.js");

class InterativePrompt {
    constructor(channel, user, title, timeout) {
        this.channel = channel;
        this.user = user;
        this.title = title;
        this.timeout = timeout;
        this.choices = {};
        this.prompts = {};
        this.next = null;
    }

    static create(channel, member, title, timeout) {
        return new InterativePrompt(channel, member, title, timeout);
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

    addPrompt(id, description, footer, filterResponses, cbChoice, maxChoices) {
        this.prompts[id] = {
            id,
            description,
            footer,
            max: maxChoices > 0 ? maxChoices : 1,
            filter: filterResponses,
            callback: cbChoice
        };
        return this;
    }

    addPromptPagination(id, description, pages, footer, filterResponses, cbChoice, maxChoices) {
        this.addPrompt(id, description, footer, filterResponses, cbChoice, maxChoices);
        this.prompts[id].pagination = true;
        this.prompts[id].pages = pages;
        this.prompts[id].pageIndex = 0;
        return this;
    }

    renderDescription(description) {
        if (typeof description === 'function') {
            return description(this.choices, this);
        }
        if (description.indexOf('#') >= 0) {
            for (let key in this.choices) {
                if (!this.choices.hasOwnProperty(key)) continue;

                description = description.replace(new RegExp('#' + key + '#', 'g'), this.choices[key]);
            }
        }
        return description;
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

                    let description = prompt.description ? this.renderDescription(prompt.description) : '';
                    let footer = prompt.footer;

                    if (prompt.pagination) {
                        description += `\n\n*(Página ${prompt.pageIndex + 1}/${prompt.pages.length})*\n`;
                        description += prompt.pages[prompt.pageIndex].trim();

                        footer += `, \`next\` para a próxima página, \`prev\` para a anterior,`;
                    }

                    const text = (this.title ? this.title + "\n\n" : "") + (description ? description + "\n\n" : "");
                    return this.channel.send(`${text}${footer} ou \`cancel\` para cancelar.`);
                }).then(msg => {
                    if (msg) {
                        oldMsg = msg;

                        const prompt = this.prompts[this.next];
                        if (!prompt) {
                            reject(new Error('Id de prompt `' + this.next + '` não existe.'));
                            return;
                        }

                        return this.channel.awaitMessages(m => {
                            // se a mensagem não for do autor do prompt, nem considera
                            if (this.user.id !== m.author.id) {
                                return false;
                            }
                            // sempre aceitar "cancel"
                            if (m.content === 'cancel') {
                                return true;
                            }
                            // se for paginação, aceitar tbm "next" e "prev"
                            if (prompt.pagination) {
                                if (['next', 'prev'].includes(m.content)) {
                                    return true;
                                }
                            }

                            // vê quais parametros são aceitos nesse prompt
                            let filterResponse = prompt.filter.apply(null, [m.content, that, m]);

                            if (!filterResponse) {
                                this.channel.send(`:x: Resposta inválida. Tente novamente ou \`cancel\` para cancelar.`)
                                    .then(mi => {
                                        return mi.delete(3000);
                                    })
                                    .catch(console.error)
                                ;
                            }

                            return filterResponse;
                        }, {
                            max: prompt.max,
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

                        const prompt = this.prompts[this.next];
                        if (!prompt) {
                            reject(new Error('Id de prompt `' + this.next + '` não existe.'));
                            return;
                        }

                        let responses = [];
                        collected.forEach(c => {
                            responses.push(c.content);
                        });

                        if (responses.includes('cancel')) {
                            return Promise.reject(collected);
                        }
                        console.log('RESPONSES', this.next, responses);

                        const response = prompt.max === 1 ? responses[0] : null;

                        if (prompt.pagination && ['next', 'prev'].includes(response)) {
                            // se for paginação e tiver escolhido mudar de pagina,
                            // não limpa o this.next, já que é pra se manter no mesmo
                            // prompt sempre até escolher algo
                            let pageToGo = prompt.pageIndex;
                            if (response === 'next') {
                                pageToGo++;
                                if (pageToGo >= prompt.pages.length) {
                                    pageToGo = 0;
                                }
                            } else if (response === 'prev') {
                                pageToGo--;
                                if (pageToGo < 0) {
                                    pageToGo = prompt.pages.length - 1;
                                }
                            }
                            prompt.pageIndex = pageToGo;
                        } else {
                            // limpa o next antes de executar o callback.
                            // o callback vai definir um, ou não.
                            // se não definir, vai finalizar
                            this.next = null;

                            const cbReturn = prompt.callback.apply(null, [response || responses, that]);
                        }

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