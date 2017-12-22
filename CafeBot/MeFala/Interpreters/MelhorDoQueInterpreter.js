
const utils = require('../../../utils');

/**
 * TODO: descricao
 *
 */
module.exports = class MelhorDoQueInterpreter {
    constructor() {}

    static interpret(user, questionPhrase, mentions) {
        return questionPhrase.match(/\w\s+(?:é|eh)\s+(?:mais(\s.+?)?|melhor|pior|menos pior)\s+(?:qu?e?\s+)?\w/i)
            || questionPhrase.match(/o q(?:ue)? (?:é|eh) (melhor|pior|menos pior)[,:. ]*(\w\s)+ ou (\w\s)+/i);
    }

    static get priority() { return 0 };

    static phrases(user, questionPhrase, mentions) {
        const positivesResponses = ['1 pouco', 'sim', 'muito', 'demais', 'bastante'];
        const negativeResponses = ['nem 1 pouco', 'nao', 'nah', 'nope', 'sai daqui'];

        let comparisonOperator = questionPhrase.match(/(mais|melhor|pior|menos pior)/i)[1];
        switch (comparisonOperator) {
            case 'melhor':
            case 'mais':
            case 'menos pior': comparisonOperator = '>'; break;
            case 'pior': comparisonOperator = '<'; break;
        }

        // função auxiliar pra transformar uma string em numeros
        function _chars(str) {
            let n = 0;
            for (let i = 0; i < str.length; i++) {
                n += str.charCodeAt(i);
            }
            return n;
        }

        let _matchedComparisons;
        let thingsToCompare = [];

        if (mentions.members && mentions.members.array().length) {
            // :eyes:
            // se for mencionados membros (ou seja, houve uma comparação
            // entre duas ou mais pessoas), então tento deixar a resposta
            // 'viciada' rsrsrs
            mentions.members.array().forEach(member => {
                thingsToCompare.push(parseInt(member.id.toString()));
            });
        } else if (_matchedComparisons = utils.matchAll(questionPhrase, /([\w\s]+)\s+(?:é|eh)\s+(?:melhor|pior|menos pior)\s+(?:qu?e?\s+)?([\w\s]+)/gi)) {

            console.log('ARRAY COMPARISONS TYPE 1', [_matchedComparisons[0][1], _matchedComparisons[0][2]]);

            // compara só as duas coisas encontradas
            thingsToCompare = [ _chars(_matchedComparisons[0][1]), _chars(_matchedComparisons[0][2]) ];

        } else if (_matchedComparisons = utils.matchAll(questionPhrase, /o q(?:ue)? (?:é|eh) (?:melhor|pior|menos pior)[,:. ]*([\w\s]+) ou ([\w\s]+)/gi)) {

            console.log('ARRAY COMPARISONS TYPE 2', [_matchedComparisons[0][1], _matchedComparisons[0][2]]);

            // compara só as duas coisas encontradas
            thingsToCompare = [ _chars(_matchedComparisons[0][1]), _chars(_matchedComparisons[0][2]) ];

        }

        // se tiver coisas pra comparar
        if (thingsToCompare.length) {
            // pra garantir que as comparações sejam sempre justas, e que
            // o usuário não tente enganar o bot colocando tipo
            //    a é melhor que b?
            // e depois
            //    b é melhor que a?
            // e retornar a mesma resposta, daí nesse caso, eu vou garantir isso
            // sempre ordenando os comparees em ordem alfabetica
            thingsToCompare.sort();
            //console.log('COMPAREES', thingsToCompare);

            // outra observação: eu faço conta de subtração aqui pq
            // matematicamente subtração depende da ordem dos fatores no resultado
            // então se as comparações estiverem invertidas, daria um resultado
            // diferente.
            // obs2: como eu to sempre ordenando os comparadores, então
            // dessa forma esse resultado sempre será um numero positivo
            const seed = thingsToCompare[1] - thingsToCompare[0];
            //console.log('SEED', seed);

            // primeiro eu vejo, baseado nos comparees, se a resposta vai ser positiva ou
            // negativa (e me baseio também na comparação, pra o usuário também não
            // tentar enganar colocando:
            //     a é melhor que b?
            // e depois
            //     a é pior que b?
            // essa lógica do comparatorOperator elimina esse problema)
            let isPositive;
            if (comparisonOperator === '>') {
                isPositive = (utils.seededRandom(seed) * 1000 >= 500);
            } else {
                isPositive = (utils.seededRandom(seed) * 1000 < 500);
            }
            //console.log('ISPOSITIVE', isPositive);
            const responsePhrases = isPositive ? positivesResponses : negativeResponses;

            // pega uma das frases, mas viciada
            const seededPhrase = utils.shuffle(responsePhrases, seed)[0];

            return [seededPhrase];
        }

        // se não, aleatório
        return [].concat(positivesResponses).concat(negativeResponses);
    }
};
