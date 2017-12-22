
const utils = require('../../utils');
const Discord = require("discord.js");

const letters = require('./letters');
const interpreters = require('./Interpreters');
const Transformer = require('./LetterTransformer');

class MeFala {
    constructor() {}

    static get name() { return 'mefala' }

    static mainCommand(message, args) {
        if (args.length === 0) {
            message.channel.send('Faça alguma pergunta.');
            return;
        }

        let phrase = args.join(" ") || '';
        console.log('PERGUNTA', phrase);
        let phrasesResult = [];
        for (let i = 0; i < interpreters.length; i++) {
            const interpreter = interpreters[i];

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
        let idx = parseInt((Math.random() * (phrasesResult.length * 2000)) / 2000);
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
                message.reply('...');
                return;
            }
        }

        // dá um reaction pra cada letra de emoji (função recursiva)
        function _react() {
            const emojiToReact = emojis.shift();
            return message.react(emojiToReact)
                .then(() => {
                    if (emojis.length) {
                        // continua enquanto tiver emoji pra mandar
                        return _react();
                    }
                    // acabou os emojis
                    return selectedPhraseResult;
                });
        }

        // (inicio a recursividade aqui)
        _react().then((selectedPhrase) => {
            // se chegou aqui, é pq todos os emojis foram enviados.
            // aqui eu sou respondido com a frase selecionada.
            // posso fazer alguma coisa ela aqui.
            // (mas a princípio, o código não vai fazer nada, mas
            // deixei aberto pra possibilidades)
            console.log('REACT ENVIOU FRASE', selectedPhrase);
        }).catch(console.error);
    }

    static commands() {
        return {
            'mefala': MeFala.mainCommand
        }
    }

}

module.exports = MeFala;