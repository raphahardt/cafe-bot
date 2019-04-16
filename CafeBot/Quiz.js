const utils = require('../utils');
let insideCount = {};

const Cafebase = require('./Cafebase');
const InteractivePrompt = require('./Util/InteractivePrompt');

// cache da ultima vez q foi usado um comando, pra evitar spam de comandos
let LAST_USED = {};

const QUIZ_QUESTIONS_CHANNEL = '567756445471342593';

class Quiz {
    constructor() {
        this.db = new Cafebase('quiz');
    }

    get modName() { return 'quiz' }

    async quizCommand(guild, message, args) {

    }

    async onReady(guild) {
        const channel = guild.channels.get(QUIZ_QUESTIONS_CHANNEL);

        if (!channel) {
            throw new Error("Canal de questões do quiz não encontrado, id " + QUIZ_QUESTIONS_CHANNEL);
        }

        let messages = await channel.fetchMessages({limit: 100});

        // deletes
        let items = await this.db.getArray('questions');
        let p = [];
        for (let item of items) {
            const m = messages.get(item.byMessage);
            if (!m) {
                // se não encontrou a mensagem, significa que é pra deletar a questão no db
                p.push(this.db.delete('questions/' + item.id)
                    .then(oldItem => {
                        // deletado com sucesso
                    }, err => console.error)
                );
            } else {
                // se encontrou, então primeiro ver se realmente precisa ser editado ou inserido
                if (m.editedAt) {
                    // foi editado, então ver se precisa ser editado uma segunda vez ou não
                    if (item.modifiedAt && m.editedAt.getTime() <= item.modifiedAt) {
                        // não precisa, então tirar da lista
                        messages.delete(m.id);
                    }
                } else {
                    // não foi editado, mas já existe no db, então ignorar
                    messages.delete(m.id);
                }
            }
        }

        // updates
        for (let message of messages.array()) {
            console.log('I ou E', message.id);
            p.push(this.manageQuestionByMessage(guild, message, 'insert'));
        }

        await Promise.all(p);
    }

    async onMessage(guild, message) {
        return this.manageQuestionByMessage(guild, message, 'insert');
    }

    async onMessageDelete(guild, message) {
        return this.manageQuestionByMessage(guild, message, 'delete');
    }

    async onMessageUpdate(guild, oldMessage, newMessage) {
        return this.manageQuestionByMessage(guild, newMessage, 'update');
    }

    async manageQuestionByMessage(guild, message, mode) {
        // se não tiver um channel
        if (!message.channel || message.author.bot) return;

        // ignora msgs pinadas e do sistema (avisos de pin)
        if (message.pinned || message.system) return;

        // se não for um dos channels de cadastro
        if (![QUIZ_QUESTIONS_CHANNEL].includes(message.channel.id)) return;

        const member = getCafeComPaoMember(guild, message);

        async function _markInvalid(message) {
            console.log('INVALID QUESTION QUIZ (MSG)', message.content);
            return message.react('❌');
        }

        async function _markValid(message, newEmoji) {
            //console.log('CREATED QUESTION QUIZ (MSG)', message.content);
            return message.react('✅');
        }

        async function _manageError(text) {
            let m = await message.reply(`:x: ${text}`);
            await _markInvalid(message);
            return m.delete(5000);
        }

        if (mode === 'delete') {
            return this.db.findOne('questions', item => item.byMessage === message.id)
                .then(item => {
                    if (item) {
                        console.log('DELETED QUESTION QUIZ (MSG)', message.content);
                        return this.db.delete('questions/' + item.id)
                            .then(oldItem => {
                                // deletado com sucesso

                            }, err => _manageError(err.message));
                    }
                })
            ;
        }

        // apaga as reacts
        await message.clearReactions();

        // valida se a formatação está correta
        if (message.content.indexOf('--') < 0) {
            return _manageError(`Pergunta com formato inválido. O formato deve ser:\nPergunta\n--\nResposta 1\nResposta 2\n**Resposta 3**\nResposta 4\n\nPerguntas e respostas separadas por \`--\` e resposta correta em negrito.`);
        }

        // formata a questao
        const parts = message.content.split(/--/, 2);
        const answersParts = parts[1].trim().split(/\n/);

        let question = parts[0].trim();
        let answers = answersParts.map(a => a.trim());

        if (answers.length < 3 || answers.length > 9) {
            return _manageError(`Número de respostas deve ser entre 3 e 9.`);
        }

        let correctAnswers = answers.filter(a => a.indexOf('**') === 0);

        if (correctAnswers.length === 0) {
            return _manageError(`É necessário pelo menos uma resposta correta.`);
        } else if (correctAnswers.length === answers.length) {
            return _manageError(`...o meu deus.`);
        }

        // normaliza as alternativas pelos indices e corrige as respostas pra ficarem sem negrito
        correctAnswers = correctAnswers.map(a => answers.indexOf(a));
        answers = answers.map(a => a.replace(/\*\*/g, ''));

        //console.log('Q', question, answers, correctAnswers);

        let item = await this.db.findOne('questions', item => item.byMessage === message.id);

        if (item) {
            // alterar
            item.question = question;
            item.answers = answers;
            item.correctAnswers = correctAnswers;
            item.modifiedAt = (new Date()).getTime();
            item.modifiedBy = member.id;
            return this.db.save('questions/' + item.id, item).then(() => {
                console.log('UPDATED QUESTION QUIZ (MSG)', message.content);
                return _markValid(message);
            }, err => {
                return _manageError(err.message);
            });
        } else {
            // inserir
            let item = {
                question,
                answers,
                correctAnswers,
                createdBy: member.id,
                createdAt: (new Date()).getTime(),
                byMessage: message.id
            };
            return this.db.insert('questions', item).then(() => {
                console.log('CREATED QUESTION QUIZ (MSG)', message.content);
                return _markValid(message);
            }, err => {
                return _manageError(err.message);
            });
        }
    }

    events() {
        return {
            'message': [this.onMessage, {guild: true}],
            'messageDelete': [this.onMessageDelete, {guild: true}],
            'messageUpdate': [this.onMessageUpdate, {guild: true}],
            'ready': [this.onReady, {guild: true}],
            //'guildMemberUpdate': this.onGuildMemberUpdate
        }
    }

    commands() {
        return {
            'quiz': [this.quizCommand, {guild: true, onlyDM: true}],
        }
    }
}

function getCafeComPaoMember(guild, message) {
    const member = guild.member(message.author);
    if (!member) {
        throw new PermissionError("Você não é um membro do Café com Pão.");
    }
    return member;
}

module.exports = Quiz;