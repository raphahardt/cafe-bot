
const Discord = require("discord.js");
const LongMessage = require("./LongMessage");

class InteractivePrompt {
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
        return new InteractivePrompt(channel, member, title, timeout);
    }

    static async createConfirm(message, confirmText, timeout = 20000) {
        const prompt = this.create(message.channel, message.author, null, timeout)
            .addPrompt(
                'interactive-confirmation',
                confirmText,
                `Digite \`sim\` para confirmar`,
                response => {
                    return ['sim'].includes(response.toLowerCase());
                },
                (choice, prompt) => {
                    prompt.setChoice('code', choice.toLowerCase());
                }
            );

        const choice = await prompt.start('interactive-confirmation');
        return (choice.code === 'sim');
    }

    setChoice(key, value) {
        this.choices[key] = value;
        return this;
    }

    getChoice(key) {
        return this.choices[key];
    }

    hasChoice(key) {
        return this.choices[key] !== undefined;
    }

    setNext(id) {
        this.next = id;
        return this;
    }

    /**
     *
     * @param id
     * @param description
     * @param footer
     * @param filterResponses
     * @param cbChoice
     * @param maxChoices
     * @return {InteractivePrompt}
     */
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

    /**
     *
     * @param id
     * @param description
     * @param pages
     * @param footer
     * @param filterResponses
     * @param cbChoice
     * @param maxChoices
     * @return {InteractivePrompt}
     */
    addPromptPagination(id, description, pages, footer, filterResponses, cbChoice, maxChoices) {
        this.addPrompt(id, description, footer, filterResponses, cbChoice, maxChoices);
        this.prompts[id].pagination = true;
        this.prompts[id].pages = pages;
        this.prompts[id].pageIndex = 0;
        return this;
    }

    /**
     *
     * @param id
     * @param descriptionTitle
     * @param options
     * @param footer
     * @param choiceName
     * @param nextId
     * @param {Function|Array} otherOptions
     * @return {InteractivePrompt}
     */
    addSimplePromptPagination(id, descriptionTitle, options, footer, choiceName, nextId, otherOptions) {
        // cria descrição
        let pages = [];
        let pageLength = 10;
        let pageIndex = 0;
        let count = 1;
        let optionValues = [], optionNext = [];

        for (let option of options) {
            if (!option) continue; // ignora opções vazias

            if (Array.isArray(option)) {
                // se tiver valor, gravar o valor
                optionValues.push(option[0]);
                optionNext.push(option[2] || nextId);
                option = option[1];
            } else {
                // se não tem valor, gravar o numero
                optionValues.push(count - 1);
                optionNext.push(nextId);
            }

            pages[pageIndex] = pages[pageIndex] || "";
            pages[pageIndex] += "\n"
                + bracket(count, options) + " "
                + option;

            count++;

            if ((count-1) % pageLength === 0) {
                pageIndex++;
            }
        }
        footer = footer || 'Escolha uma opção';

        // outras opções aceitas pelo filtro
        let otherFilter;
        if (Array.isArray(otherOptions)) {
            otherFilter = (resp) => {
                return otherOptions.includes(resp);
            };
        } else if (typeof otherOptions === 'function') {
            otherFilter = otherOptions;
        } else {
            // noop function
            otherFilter = () => false;
        }

        // cria filter responses fn
        const filter = response => {
            const v = parseInt(response);
            return (v >= 1 && v < count) || otherFilter(response);
        };

        // cria choice fn
        if (typeof choiceName !== 'function') {
            const n = choiceName;
            choiceName = (choice, prompt) => {
                if (otherFilter(choice)) {
                    throw new Error("Opção " + choice + " não esperada. Quando você usa o 'otherOptions', o 'choiceName' precisa ser uma function.");
                }
                const index = parseInt(choice) - 1;
                const value = optionValues[index];
                prompt.setChoice(n, value);
                if (optionNext[index]) {
                    prompt.setNext(optionNext[index]);
                }
            }
        } else {
            const fn = choiceName;
            choiceName = (choice, prompt) => {
                const of = otherFilter(choice);
                const n = fn(choice, prompt, of);
                if (typeof n === "function") {
                    n(choice, prompt);
                } else if (typeof n === "string") {
                    if (of) {
                        throw new Error("Opção " + choice + " não esperada. Quando você usa o 'otherOptions', o 'choiceName' precisa tratar essas opções extraordinárias e retornar o nome do key a ser colocado o valor, ou uma function.");
                    }
                    const index = parseInt(choice) - 1;
                    const value = optionValues[index];
                    prompt.setChoice(n, value);
                    if (optionNext[index]) {
                        prompt.setNext(optionNext[index]);
                    }
                } else {
                    // qualquer coisa retornada além de function ou string, ignorar
                    // pois já considero que foi resolvido pela propria funcion ou pela funcao padrão
                    // quando retorna string
                }
            }
        }

        return this.addPromptPagination(id, descriptionTitle, pages, footer, filter, choiceName, 1);
    }

    /**
     * TODO: adicionar otherOptions igual no addSimplePromptPagination
     * @param id
     * @param descriptionTitle
     * @param options
     * @param footer
     * @param choiceName
     * @param nextId
     * @return {InteractivePrompt}
     */
    addSimplePromptOptions(id, descriptionTitle, options, footer, choiceName, nextId) {
        // cria descricao
        let descr = '';
        let count = 1;
        let optionValues = [], optionNext = [];

        for (let option of options) {
            if (!option) continue; // ignora opções vazias

            if (Array.isArray(option)) {
                // se tiver valor, gravar o valor
                optionValues.push(option[0]);
                optionNext.push(option[2] || nextId);
                option = option[1];
            } else {
                // se não tem valor, gravar o numero
                optionValues.push(count - 1);
                optionNext.push(nextId);
            }
            descr += "\n"
                + bracket(count, options) + " "
                + option
            ;
            count++;
        }
        footer = footer || 'Escolha uma opção';

        // cria filter responses fn
        const filter = response => {
            const v = parseInt(response);
            return v >= 1 && v < count;
        };

        // cria choice fn
        if (typeof choiceName !== 'function') {
            const n = choiceName;
            choiceName = (choice, prompt) => {
                const index = parseInt(choice) - 1;
                const value = optionValues[index];
                prompt.setChoice(n, value);
                if (optionNext[index]) {
                    prompt.setNext(optionNext[index]);
                }
            }
        }

        return this.addPrompt(id, descr.trim(), footer, filter, choiceName, 1);
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

    start(id, initialArgs) {
        const that = this;
        //this.choices = {};
        this.next = id;

        if (Array.isArray(initialArgs) && initialArgs.length > 0) {
            while (initialArgs.length) {
                let arg = initialArgs.shift();

                console.log('INITIAL ASK', arg, this.next);
                const prompt = this.prompts[this.next];
                if (!prompt) {
                    throw new Error('Id de prompt `' + this.next + '` não existe.');
                }

                // vê quais parametros são aceitos nesse prompt
                let filterResponse = prompt.filter.apply(null, [arg, this, null]);

                if (!filterResponse) {
                    throw new Error('Parâmetro(s) inválido(s). ' +
                        'Se não se lembra do caminho do comando, prefira usar o comando puro e seguir a tela interativa.');
                }

                console.log('INITIAL CREATE RESPONSES', this.next, prompt.max, arg);

                // pegar as responses possiveis, de acordo com o max
                let responses = [];
                let max = prompt.max;
                while (max--) {
                    responses.push(arg);
                    if (max > 0 && initialArgs.length > 0) {
                        arg = initialArgs.shift();
                    }
                }

                console.log('INITIAL RESPONSES', this.next, responses);
                const response = prompt.max === 1 ? responses[0] : null;

                // limpa o next antes de executar o callback.
                // o callback vai definir um, ou não.
                // se não definir, vai finalizar
                this.next = null;

                const cbReturn = prompt.callback.apply(null, [response || responses, this]);

                if (!this.next) {
                    // se não tem mais next, terminar
                    break;
                }
            }

            // se terminar sem next, já termina aqui, sem chamar nenhum prompt
            if (!this.next) {
                return Promise.resolve(this.choices);
            }
        }

        let oldMsg;
        let longMsg = new LongMessage(this.channel, this.user);
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
                    let footer = this.renderDescription(prompt.footer);

                    if (prompt.pagination) {
                        description += `\n\n*(Página ${prompt.pageIndex + 1}/${prompt.pages.length})*\n`;
                        description += prompt.pages[prompt.pageIndex].trim();

                        footer += `, \`next\` para a próxima página, \`prev\` para a anterior,`;
                    }

                    // adiciona um padding no lado esquerdo
                    description = description.replace(/^/mg, "│ ");

                    const text = ""
                        +     "┌────────────────────── ─ -\n"
                        + (this.title
                            ? this.title.replace(/^/mg, "│ ") + "\n"
                            + "├────────────────────── ─ -\n"
                            : "")
                        + (description
                            ? description + "\n"
                            + "└────────────────────── ─ -\n"
                            : "")
                    ;
                    return longMsg.send(`${text}${footer} ou \`cancel\` para cancelar.`);
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
                        reject("Expirado");
                    } else {
                        this.channel.send(`:x: Cancelado.`);
                        reject("Cancelado");
                    }
                } else {
                    reject(error);
                }
            });
        });
    }
}

function bracket(index, items) {
    // verifica quantos digitos terá de padding
    let digits = 1, len = items.length;
    while (len >= 10) {
        digits++;
        len = parseInt(len / 10);
    }

    const padded = String(" ".repeat(digits) + index).slice(-digits);

    return `\`[${padded}]\``;
}

module.exports = InteractivePrompt;