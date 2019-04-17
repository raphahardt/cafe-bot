const utils = require('../utils');
const Discord = require("discord.js");
const Cafebase = require('./Cafebase');
const InteractivePrompt = require('./Util/InteractivePrompt');
const randomNumber = require('./Util/RandomNumber');

const EMOJI_NUMBERS = [/*'0⃣', */'1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '9⃣'];
const EMOJI_LETTERS = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯', '🇰', '🇱', '🇲', '🇳', '🇴', '🇵', '🇶', '🇷', '🇸', '🇹', '🇺', '🇻', '🇼', '🇽', '🇾', '🇿'];
const EMOJI_CANCEL = '🚫';

const QUIZ_EMOJI = ':checkered_flag:';
const QUIZ_COST = 1200;
const QUIZ_QUESTIONS_CHANNEL = '567756445471342593';
const QUIZ_PHASES = 3;
const QUIZ_PHASE_QUESTION_COUNT = 2;
const QUIZ_QUESTION_TOTAL = QUIZ_PHASES * QUIZ_PHASE_QUESTION_COUNT;
const QUIZ_TIMEOUT = 45000;

class Quiz {
    constructor(gachaModule) {
        this.db = new Cafebase('quiz');
        this.gacha = gachaModule;
        this.inQuiz = {};
    }

    get modName() { return 'quiz' }

    enterQuiz(message) {
        this.inQuiz[message.author.id] = new Date();
    }

    isInQuiz(message) {
        return !!(this.inQuiz[message.author.id]);
    }

    exitQuiz(message) {
        delete this.inQuiz[message.author.id];
    }

    async quizCommand(guild, message, args) {
        const channel = message.channel;
        const user = message.author;

        if (this.isInQuiz(message)) return;

        let confirmText = QUIZ_EMOJI + " -- **Café com Pão Archives** --\n\n";
        confirmText += "Custa `" + QUIZ_COST + " tokens` para participar.\n";
        confirmText += "Confirma?";
        const confirm = await InteractivePrompt.createConfirm(message, confirmText);

        if (confirm) {
            try {
                //await this.gacha.consumeTokens(message.author, 1200);
            } catch (e) {
                return message.reply(`:x: ${e.message}`);
            }

            this.enterQuiz(message);

            try {
                let alreadyQuestions = [];
                let choices = [];

                for (let phase = 0; phase < QUIZ_PHASES; phase++) {
                    for (let questionNumber = 0; questionNumber < QUIZ_PHASE_QUESTION_COUNT; questionNumber++) {
                        const currentNumber = questionNumber + phase * QUIZ_PHASE_QUESTION_COUNT;
                        let question = await this.getRandomQuestion(alreadyQuestions);

                        const response = await this.makeQuestion(message, channel, question, currentNumber);

                        choices.push(response);
                    }

                    // verifica se pode passar pra proxima fase
                    let wrongChoices = choices.filter(c => !c.correct);

                    if (wrongChoices.length) {
                        // teve erradas, parar o jogo
                        this.exitQuiz(message);

                        return message.reply(`${QUIZ_EMOJI} | :x: Você errou **${wrongChoices.length} pergunta(s)**, infelizmente. Tenta de novo.`);
                    } else {
                        // tudo certo até agora, continuar
                        const phaseNumber = phase + 2;
                        if (phaseNumber > QUIZ_PHASES) {
                            // acabou o jogo
                        } else {
                            const phaseText = phaseNumber === QUIZ_PHASES ? 'última fase' : 'fase ' + (phaseNumber);
                            const next = await message.reply(`${QUIZ_EMOJI} | :white_check_mark: Parabéns, você passou pra **${phaseText}**!`);
                            await next.delete(2000);
                        }
                    }
                }

                // fim de jogo, acertou tudo
                const checkCorrects = choices.filter(c => !!c.correct).length;

                if (checkCorrects === QUIZ_QUESTION_TOTAL) {
                    // realmente ganhou
                } else {
                    message.reply(`${QUIZ_EMOJI} | :x: Você errou **${QUIZ_QUESTION_TOTAL - checkCorrects} pergunta(s)**, infelizmente. Tenta de novo.`);
                }

                this.exitQuiz(message);
            } catch (e) {
                console.log('CANCELOU OU TIMEOUT', e);
                if (e === 'timeout') {
                    return message.reply(`${QUIZ_EMOJI} | :x: Tempo esgotado!`);
                } else if (e === 'cancel') {
                    return message.reply(`${QUIZ_EMOJI} | :x: Você cancelou. Seus tokens não voltarão.`);
                } else {

                }

                // cancelou ou timeout
                this.exitQuiz(message);
            }
        }
    }

    async getQuestion(id) {
        return this.db.getOne('questions/' + id);
    }

    async getRandomQuestion(alreadyQuestions) {
        let filter = (question) => {
            return !alreadyQuestions.includes(question.id);
        };
        let questions = await this.db.findAll('questions', filter);
        //console.log('questions encontradas', questions.length);
        const index = Math.floor(await randomNumber(0, questions.length - 1));

        const question = questions[index];
        alreadyQuestions.push(question.id);
        //console.log('questions already', alreadyQuestions);

        return question;
    }

    async sendQuestion(channel, question, number) {
        let text = '';
        text += EMOJI_LETTERS[number] + " ";
        text += question.question + "\n";
        let initialText = text + '';

        // para embaralhar as respostas
        let corrects = question.correctAnswers.map(ca => question.answers[ca]);
        question.answers = utils.shuffle(utils.shuffle(question.answers));
        question.correctAnswers = corrects.map(c => question.answers.indexOf(c));

        for (let i = 0; i < question.answers.length; i++) {
            text += '**' + (i + 1) + ')** ' + question.answers[i];
            text += " " + (question.correctAnswers.includes(i) ? ' CORRETA' : '');
            text += "\n";
        }

        const m = await channel.send(initialText);
        for (let i = 0; i < question.answers.length; i++) {
            await m.react(EMOJI_NUMBERS[i]);
        }
        await m.react(EMOJI_CANCEL);
        await m.edit(text);

        return m;
    }

    async makeQuestion(message, channel, question, number) {
        let m = await this.sendQuestion(channel, question, number);
        let filter = (reaction, user) => {
            let r = user.id === message.author.id;
            r = r && (EMOJI_NUMBERS.includes(reaction.emoji.name) || reaction.emoji.name === EMOJI_CANCEL);
            return r;
        };
        let collector = new Discord.ReactionCollector(m, filter, { max: 1, time: QUIZ_TIMEOUT });

        return new Promise((resolve, reject) => {
            collector.on('end', async (collected) => {
                await m.delete();

                if (collected.size) {
                    // teve reaction, verificar qual é
                    const react = collected.first();

                    if (react.emoji.name === EMOJI_CANCEL) {
                        // cancelar
                        reject('cancel');
                    } else {
                        const indexChoice = EMOJI_NUMBERS.indexOf(react.emoji.name);
                        resolve({ correct: question.correctAnswers.includes(indexChoice) });
                    }
                } else {
                    // timeout
                    reject('timeout');
                }
            });
        });
    }

    async onReady(guild) {
        const channel = guild.channels.get(QUIZ_QUESTIONS_CHANNEL);

        if (!channel) {
            throw new Error("Canal de questões do quiz não encontrado, id " + QUIZ_QUESTIONS_CHANNEL);
        }

        let messages = await channel.fetchMessages({limit: 100});

        // deletes
        let questions = await this.db.getArray('questions');
        let p = [];
        for (let question of questions) {
            const m = messages.get(question.byMessage);
            if (!m) {
                // se não encontrou a mensagem, significa que é pra deletar a questão no db
                p.push(this.db.delete('questions/' + question.id)
                    .then(oldItem => {
                        // deletado com sucesso
                    }, err => console.error)
                );
            } else {
                // se encontrou, então primeiro ver se realmente precisa ser editado ou inserido
                if (m.editedAt) {
                    // foi editado, então ver se precisa ser editado uma segunda vez ou não
                    if (question.modifiedAt && m.editedAt.getTime() <= question.modifiedAt) {
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
            p.push(this.manageQuestionByMessage(guild, message, 'insert', true));
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

    async manageQuestionByMessage(guild, message, mode, surpressErrors = false) {
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
            if (surpressErrors) {
                return _markInvalid(message);
            }
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

        let questionTitle = parts[0].trim();
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

        //console.log('Q', questionTitle, answers, correctAnswers);

        let question = await this.db.findOne('questions', item => item.byMessage === message.id);

        if (question) {
            // alterar
            question.question = questionTitle;
            question.answers = answers;
            question.correctAnswers = correctAnswers;
            question.modifiedAt = (new Date()).getTime();
            question.modifiedBy = member.id;
            return this.db.save('questions/' + question.id, question).then(() => {
                console.log('UPDATED QUESTION QUIZ (MSG)', message.content);
                return _markValid(message);
            }, err => {
                return _manageError(err.message);
            });
        } else {
            // inserir
            question = {
                question: questionTitle,
                answers,
                correctAnswers,
                createdBy: member.id,
                createdAt: (new Date()).getTime(),
                byMessage: message.id
            };
            return this.db.insert('questions', question).then(() => {
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
            //'ready': [this.onReady, {guild: true}],
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