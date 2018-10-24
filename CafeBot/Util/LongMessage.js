const Discord = require("discord.js");

/**
 * Lida com mensagens com mais de 2000 caracteres.
 * Ele é inteligente o suficiente pra não separar metades de frases.
 */
class LongMessage {
    constructor(channel, author) {
        this.channel = channel;
        this.author = author;
        this.messages = [];

        // faixa de 30 caracteres pra menos só pra garantir
        this.MAX_MESSAGE_LENGTH = 1970;
    }

    /**
     * Divide o texto longo entre pedaços de 2000 caracteres ou menos.
     * Usa os separators como parametro para saber onde separar.
     *
     * @param text
     * @param separators
     * @return {IterableIterator<*>}
     */
    *generateChunks(text, separators) {
        // se nem passa dos 2000 caracteres, nao tem nem pq fazer tudo isso
        if (text.length <= this.MAX_MESSAGE_LENGTH) {
            yield text;
            return;
        }

        if (!separators.length) {
            // entao infelizmente separa POR caractere
            let chunks = text.match(new RegExp('.{1,' + this.MAX_MESSAGE_LENGTH + '}', 'g'));
            for (let k = 0; k < chunks.length; k++) {
                yield chunks[k];
            }
        } else {
            let separator = separators.shift();
            if (!(text.indexOf(separator) >= 0)) {
                // se nao tem o simbolo, tenta com o proximo
                yield* this.generateChunks(text, separators);
            } else {
                // se tem, tenta separar
                let arrayText = text.split(separator).map(t => t + separator);
                let textRow = "";
                for (let i = 0; i < arrayText.length; i++) {
                    const row = arrayText[i];
                    if (textRow.length + row.length > this.MAX_MESSAGE_LENGTH) {
                        yield textRow;
                        textRow = "";
                    }
                    if (row.length > this.MAX_MESSAGE_LENGTH) {
                        // se mesmo assim a msg ta grande, tenta com o proximo
                        yield* this.generateChunks(row, separators);
                    } else {
                        textRow += row;
                    }
                }
                // o que sobrou do ultimo chunk de row
                if (textRow) yield textRow;
            }
        }
    }

    /**
     * Envia uma mensagem com mais de 2000 caracteres.
     *
     * @param longContent
     * @return {Promise<LongMessage>}
     */
    async send(longContent) {
        this.messages = [];

        for (let chunk of this.generateChunks(longContent, ["\n", " "])) {
            const message = await this.channel.send(chunk);
            this.messages.push(message);
        }

        return this;
    }

    /**
     * Envia uma mensagem com mais de 2000 caracteres, mas respondendo pra alguém.
     *
     * @param longContent
     * @return {Promise<LongMessage>}
     */
    async reply(longContent) {
        if (this.author && !(this.channel instanceof Discord.DMChannel)) {
            longContent = `${this.author}, ` + longContent;
        }

        return this.send(longContent);
    }

    /**
     * Edita uma mensagem com mais de 2000 caracteres.
     *
     * @param longContent
     * @return {Promise<LongMessage>}
     */
    async edit(longContent) {
        let oldMessages = this.messages.slice();
        let newMessages = [];

        let index = 0;
        for (let chunk of this.generateChunks(longContent, ["\n", " "])) {
            let message;
            if (oldMessages[index]) {
                message = oldMessages[index];
                await message.edit(chunk);
            } else {
                // adiciona uma mensagem nova, se precisar de mais espaço
                message = await this.channel.send(chunk);
            }
            newMessages.push(message);
            index++;
        }

        // deleta as mensagens que sobraram, caso sobrarem
        if (newMessages.length < oldMessages.length) {
            for (let i = newMessages.length; i < oldMessages.length; i++) {
                await oldMessages[i].delete();
            }
        }

        this.messages = newMessages;
        return this;
    }

    /**
     * Edita uma mensagem com mais de 2000 caracteres, mas respondendo pra alguém.
     *
     * @param longContent
     * @return {Promise<LongMessage>}
     */
    async editReply(longContent) {
        if (this.author && !(this.channel instanceof Discord.DMChannel)) {
            longContent = `${this.author}, ` + longContent;
        }

        return this.edit(longContent);
    }

    /**
     * Deleta uma mensagem com mais de 2000 caracteres.
     *
     * @param timeout
     * @return {Promise<LongMessage>}
     */
    async delete(timeout) {
        if (this.messages.length) {
            let promises = [];
            for (let i = 0; i < this.messages.length; i++) {
                promises.push(this.messages[i].delete(timeout));
            }
            await Promise.all(promises);
            this.messages = [];
        }

        return this;
    }
}

module.exports = LongMessage;