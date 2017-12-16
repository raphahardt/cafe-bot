
const utils = require('../../utils');
const Discord = require("discord.js");

const letters = require('./letters');
const interpreters = require('./Interpreters');
const Transformer = require('./LetterTransformer');

class MeFala {
    constructor() {}

    static mainCommand(message, args) {
        if (args.length === 0) {
            message.channel.send('Faça alguma pergunta.');
            return;
        }

        let phrase = args.join("\s") || '';
        console.log('PERGUNTA', phrase);
        let phrasesResult = [];
        for (let i = 0; i < interpreters.length; i++) {
            const interpreter = interpreters[i];

            // se um interpreter achar que ele deve responder a mensagem do usuário...
            if (interpreter.interpret(message.author, phrase, message.mentions)) {
                // ...então pegar as possiveis frases que ele tem a dizer
                phrasesResult = interpreter.phrases(message.author, message.mentions);
                if (!Array.isArray(phrasesResult)) {
                    phrasesResult = [phrasesResult];
                }
                console.log('INTERPRETER RESULT', phrasesResult);
                break;
            }
        }

        // se nenhum interpreter retornar nenhuma frase, então o comando nem continua
        if (!phrasesResult.length) return;

        // pega uma das frases aleatoriamente
        let idx = parseInt((Math.random() * (phrasesResult.length * 2000)) / 2000);
        idx = Math.min(phrasesResult.length - 1, idx);
        console.log('IDX', idx);
        const selectedPhraseResult = phrasesResult[ idx ];
        console.log('PHRASE SELECTED', selectedPhraseResult);

        // usa o transformer pra transformar essa frase em emojis
        let emojis = Transformer.transform(selectedPhraseResult);
        console.log('EMOJIS', emojis);

        // dá um reactor pra cada letra de emoji
        function _react() {
            const emojiToReact = emojis.shift();
            return message.react(emojiToReact)
                .then(() => {
                    if (emojis.length) {
                        return _react();
                    }
                    // acabou os emojis
                    return selectedPhraseResult;
                });
        }

        _react().then((response) => {
            // response === selectedPhraseResult
            console.log('EMOJIS', response);
        }).catch(console.error);
    }

    static commands() {
        return {
            'mefala': MeFala.mainCommand
        }
    }

}

module.exports = MeFala;