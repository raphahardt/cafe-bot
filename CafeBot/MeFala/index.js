
const utils = require('../../utils');
const Discord = require("discord.js");

const Transformer = require('./LetterTransformer');
const path = require('path');

class MeFala {
    constructor() {
        let interpreters = require('require-all')(path.join(__dirname, 'Interpreters'));
        interpreters = Object.values(interpreters);

        // ordenar por ordem de prioridade
        interpreters.sort(function (a, b) {
            return b.priority - a.priority;
        });

        this.interpreters = interpreters || [];
    }

    get modName() { return 'mefala' }

    /**
     *
     * @param {Message} message
     * @param args
     * @returns {Promise<*>}
     */
    async mainCommand(message, args) {
        if (args.length === 0) {
            return message.reply(':speaking_head: Faça alguma pergunta.');
        }

        let phrase = args.join(" ") || '';
        //console.log('PERGUNTA', phrase);
        let phrasesResult = [];
        for (let i = 0; i < this.interpreters.length; i++) {
            const interpreter = this.interpreters[i];

            if (typeof interpreter.init === 'function') {
                await interpreter.init();
            }

            // se um interpreter achar que ele deve responder a mensagem do usuário...
            if (interpreter.interpret(message.author, phrase, message.mentions)) {
                // ...então pegar as possiveis frases que ele tem a dizer
                phrasesResult = interpreter.phrases(message.author, phrase, message.mentions);
                if (!Array.isArray(phrasesResult)) {
                    phrasesResult = [phrasesResult];
                }
                break;
            }
        }

        // se nenhum interpreter retornar nenhuma frase, então o comando nem continua
        if (!phrasesResult.length) return;

        // misturo antes...
        phrasesResult = utils.shuffle(phrasesResult);
        // ...e pego aleatoriamente uma das frases aleatoriamente
        let idx = Math.round((Math.random() * (phrasesResult.length * 2000)) / 2000);
        idx = Math.min(phrasesResult.length - 1, idx);

        // frase que foi selecionada
        const selectedPhraseResult = phrasesResult[ idx ];

        // usa o transformer pra transformar essa frase em emojis
        let emojis = Transformer.transform(selectedPhraseResult);

        if (!emojis) {
            // não teve estoque de emoji suficiente, então
            // pega uma frase do RandomInterpreter mesmo
            emojis = Transformer.transform(utils.shuffle(['nao', 'sim', 'nem fodendo', 'obvio', 'nao sei', 'ata'])[0]);

            if (!emojis) {
                // se por algum motivo, ainda não vir emojis
                return message.reply(':x: Erro no `+mefala`.');
            }
        }

        // dá um reaction pra cada letra de emoji
        async function _react() {
            while (!message.deleted && emojis.length) {
                await message.react(emojis.shift());
            }

            return selectedPhraseResult;
        }

        // (inicio a recursividade aqui)
        return _react().then((selectedPhrase) => {
            // se chegou aqui, é pq todos os emojis foram enviados.
            // aqui eu sou respondido com a frase selecionada.
            // posso fazer alguma coisa ela aqui.
            // (mas a princípio, o código não vai fazer nada, mas
            // deixei aberto pra possibilidades)
            //console.log('REACT ENVIOU FRASE', selectedPhrase);
        });
    }

    commands() {
        return {
            'mefala': this.mainCommand
        }
    }

}

module.exports = MeFala;
