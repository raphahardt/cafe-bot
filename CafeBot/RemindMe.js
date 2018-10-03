
const fbAdmin = require("firebase-admin");
const fbServiceAccount = require("../misc/cafebot-2018-firebase-adminsdk-j17ic-a11e9f3222.json");
const utils = require('../utils');
const ADMIN_IDS = require('../adminIds');
const Discord = require("discord.js");

const fbApp = fbAdmin.initializeApp({
    credential: fbAdmin.credential.cert(fbServiceAccount),
    databaseURL: "https://cafebot-2018.firebaseio.com"
}, 'remindme');

const db = fbApp.database();
const ref = db.ref('remindme');

class RemindMe {
    constructor () {}

    static get modName() { return 'remindme' }

    static remindCommand(message, args) {

        const arg = args.shift();
        switch (arg) {
            case 'create':
            case 'c':
                return RemindMe.remindCreateCommand(message, args);
            case 'list':
            case 'l':
                return RemindMe.remindListCommand(message, args);
            case 'delete':
            case 'del':
            case 'd':
                return RemindMe.remindDeleteCommand(message, args);
            case 'reset':
                return RemindMe.remindDeleteAllCommand(message, args);
            case 'help':
                message.reply('__*Comandos disponíveis*__:\n**+remind create** ou **+remindme**\nO formato para uso é: `(+remindme | +remind create) mensagem (in | every) (X (days | hours | minutes | weeks | months (day X)?) | sunday | monday | tuesday | wednesday | thursday | friday | saturday | weekend | workdays | XX/XX/XXXX) (at XX:XX)?`\nOs *parenteses* significam agrupamento de opções, **não** usar eles no comando, assim como os *pipelines* também - que indicam a separação de cada opção. A *interrogação* significa que aquele parametro é opcional. No caso do `at`, os horários são baseados no horário de brasília (BRT|BRST). Caso não use o `at`, o horário a ser considerado será o horário em que o evento foi criado.\n\nExemplos de uso:\n`+remindme algo in 5 hours` lembra uma vez daqui 5 horas\n`+remindme algo every 1 month day 4 at 5:00` lembra repetidamente todo dia 4 a cada mês as 5h da manhã\n`+remindme algo every monday friday` lembra repetidamente todas segundas e sextas\n`+remindme algo in 2 days at 14:00`. lembra uma vez daqui 2 dias as 14h\n\n**+remind list**\nMostra todos os eventos que você tem cadastrados.\n\n**+remind delete *id***\nExclui um evento cadastrado pelo id.\n\n**+remind reset**\nExclui todos seus eventos.');
                break;
            default:
                message.reply(`:x: Comando inexistente.\nComandos disponíveis: \`help\`, \`create\`, \`list\`, \`delete\`, \`reset\``);
        }
    }

    /**
     * Atalho para +remind create
     *
     * @param message
     * @param args
     * @return {*}
     */
    static remindMeCommand(message, args) {
        // só um atalho de +remindme x pra +remind create x
        return RemindMe.remindCommand(message, ['create'].concat(args));
    }

    /**
     * Cria um evento de modo avançado, com sintaxe do cron direto.
     *
     * @param message
     * @param args
     */
    static remindMeAdvancedCommand(message, args) {
        if (args[0] === 'help') {
            message.reply(`__*Comandos disponíveis*__:
**+remindmeplus**
Usado pra você mesmo manipular a frequencia do seu evento, usando a sintaxe do *crontab*.
Deve ser usado da seguinte forma: \`+remindmeplus 10 5 * * * * 0 mensagem\`, onde os 7 primeiros parametros são o agendamento do seu evento.
Os parametros são compostos por

\`m h d M w y r\`

Onde:
\`m\`: (obrigatório) número do minuto a ser executado.
\`h\`: (obrigatório) número da hora a ser executado. 
\`d\`: número do dia do mês a ser executado. 
\`M\`: número do mês a ser executado. 
\`w\`: número do dia da semana a ser executado, sendo domingo 0 e sábado 6. 
\`y\`: número do ano a ser executado (no *crontab* não existe). 
\`r\`: se o evento é pra ser repetido, coloque 1. Se é só uma vez, 0. (no *crontab* não existe). 

Cada um desses parametros pode ser separado por vírgula para abranger mais opções, ou usar hífen para fazer um range. Por exemplo, se no \`m\` colocar \`0,15,30,45\` o evento será executado nos minutos 0, 15, 30 e 45, ou seja, a cada 15 minutos. Outro exemplo, no \`h\` colocar \`5-10\` o evento será executado entre as 5 e 10 horas, a cada 1 hora.
Os parametros que não forem obrigatórios você pode colocar um \`*\` no lugar, que significa que vai executar independente do valor que for.

Exemplos de uso:
\`+remindmeplus 0,30 14 * * 1 * 1 algo\`
esse evento vai ser executado *repetidamente* toda segunda-feira, não importa o dia, o mês ou o ano, quando for 14:00 e quando for 14:30
\`+remindmeplus 15 20 4 1-12 * * 1 algo\`
esse evento vai ser executado *repetidamente* todo dia 4 de cada mês, não importa o dia da semana ou o ano, às 20:15 exatos
\`+remindmeplus 30 23 * * * * 0 algo\`
esse evento vai ser executado *uma vez só* às 23:30, não importando que dia, que mês, que dia semana ou que ano seja
`);
            return;
        }

        try {
            let pattern = [];
            let content;
            let repeatEvent;

            for (let i = 0; i < 6; i++) {
                pattern.push(args.shift());
            }
            repeatEvent = !!args.shift();
            content = args.join(' ');
            pattern = pattern.join(' ');

            let event = {
                author: message.author.id,
                content: content,
                pattern: pattern,
                syntax: pattern,
                loop: repeatEvent,
                createdAt: (new Date()).getTime(),
                lastExecutedAt: null
            };

            const now = new Date();
            event.nextExecution = findNextExecution(event, now).getTime();

            let savedEvent = ref.child('events').push();
            event.id = savedEvent.key;

            savedEvent.set(event, err => {
                if (err) {
                    message.reply(`:x: Houve um erro ao gravar seu evento: ${err}`);
                    return;
                }
                message.reply(`:white_check_mark: Evento \`${event.id}\` registrado. Te avisarei em **${formatFutureDate(now, event.nextExecution)}**`);
            });

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /**
     * Cria um evento.
     *
     * @param message
     * @param args
     */
    static remindCreateCommand(message, args) {
        try {
            let author = message.author;
            let members = utils.resolveAllMentioned(message, args, false, true);
            if (members.length > 0) {
                if (message.author.id !== '208028185584074763') {
                    message.reply(`:x: *Você não tem permissão.*`);
                    return;
                }
                author = members[0];
            }

            const [content, pattern, repeatEvent, syntax] = interpretEvent(args);

            let event = {
                author: author.id,
                content: content,
                pattern: pattern,
                syntax: syntax,
                loop: repeatEvent,
                createdAt: (new Date()).getTime(),
                lastExecutedAt: null
            };

            const now = new Date();
            event.nextExecution = findNextExecution(event, now).getTime();

            let savedEvent = ref.child('events').push();
            event.id = savedEvent.key;

            savedEvent.set(event, err => {
                if (err) {
                    message.reply(`:x: Houve um erro ao gravar seu evento: ${err}`);
                    return;
                }
                message.reply(`:white_check_mark: Evento \`${event.id}\` registrado. Te avisarei em **${formatFutureDate(now, event.nextExecution)}**`);
            });

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /**
     * Lista os eventos de um usuário.
     *
     * @param message
     * @param args
     */
    static remindListCommand(message, args) {
        try {
            const isDebug = args.includes('--debug') && ADMIN_IDS.includes(message.author.id);
            const now = new Date();

            ref.child('events').once('value', snapshot => {
                const events = snapshot.val();
                let foundEvents = '';

                for (let id in events) {
                    if (!events.hasOwnProperty(id)) continue;
                    const ev = events[id];
                    if (isDebug || ev.author === message.author.id) {
                        foundEvents += `\n:small_blue_diamond: ` + (isDebug ? `<@${ev.author}> ` : '') + `\`${ev.id}\` **${ev.content}** ${ev.syntax}` + (ev.nextExecution ? ' *(em ' + formatFutureDate(now, ev.nextExecution) + ')*' : '');
                    }
                }

                if (!foundEvents) {
                    message.reply(`:x: Nenhum evento registrado. Crie um com \`+remindme\` ou \`+remind help\` para saber mais.`);
                    return;
                }

                utils.sendLongMessage(message.channel, `${message.author}, Seus eventos registrados:${foundEvents}`);
            });

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /**
     * Delete um evento
     *
     * @param message
     * @param args
     */
    static remindDeleteCommand(message, args) {
        try {
            const isDebug = args.includes('--debug') && ADMIN_IDS.includes(message.author.id);
            const eventId = args[0];

            ref.child('events/' + eventId).once('value', snapshot => {
                const event = snapshot.val();

                if (!event) {
                    message.reply(`:x: Evento não existe.`);
                    return;
                }

                if (!isDebug && event.author !== message.author.id) {
                    message.reply(`:x: Você não é autor deste evento.`);
                    return;
                }

                ref.child('events/' + eventId).set(null, err => {
                    if (err) {
                        message.reply(`:x: Houve um erro ao deletar seu evento: ${err}`);
                        return;
                    }

                    message.reply(`:white_check_mark: Evento \`${eventId}\` deletado com sucesso.`);
                });
            });

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /**
     * Apaga todos os eventos de um usuário.
     *
     * @param message
     * @param args
     */
    static remindDeleteAllCommand(message, args) {
        try {
            let author = message.author;
            /*let members = utils.resolveAllMentioned(message, args, false, true);
            if (members.length > 0) {
                if (message.author.id !== '208028185584074763') {
                    message.reply(`:x: *Você não tem permissão.*`);
                    return;
                }
                author = members[0];
            }*/

            ref.child('events').once('value', snapshot => {
                const events = snapshot.val();
                let deleteEvents = [];

                for (let id in events) {
                    if (!events.hasOwnProperty(id)) continue;
                    const ev = events[id];
                    if (ev.author === author.id) {
                        deleteEvents.push(id);
                    }
                }

                if (!deleteEvents.length) {
                    message.reply(`:x: Nenhum evento registrado. Crie um com \`+remindme\` ou \`+remind help\` para saber mais.`);
                    return;
                }

                for (let i = 0; i < deleteEvents.length; i++) {
                    deleteEvents[i] = ref.child('events/' + deleteEvents[i]).set(null);
                }

                Promise.all(deleteEvents).then((events) =>{
                    message.reply(`:white_check_mark: Todos seus ${events.length} eventos foram deletados com sucesso.`);
                }).catch(err => {
                    message.reply(`:x: Erro ao excluir todos seus eventos: ${err}`);
                });
            });

        } catch (error) {
            console.error(error);
            message.reply(`:x: ${error.message}`);
        }
    }

    /**
     * Timer que roda a cada 1 minuto automaticamente.
     *
     * @param client
     * @param seconds
     * @param minutes
     * @param hours
     * @param day
     * @param month
     * @param dayWeek
     * @param year
     * @param date
     */
    static remindTimer(client, seconds, minutes, hours, day, month, dayWeek, year, date) {
        try {
            ref.child('events').once('value', snapshot => {
                const events = snapshot.val();

                for (let id in events) {
                    if (!events.hasOwnProperty(id)) continue;
                    let ev = events[id];

                    let patternParts = parsePattern(ev.pattern);
                    let activate = true;

                    //console.log(patternParts);

                    // verifica se pattern cumpre as exigencias
                    let tests = [minutes, hours, day, month, dayWeek, year];
                    tests.forEach((value, index) => {
                        activate = activate
                            && (    patternParts[index].includes(value)
                                 || patternParts[index].includes(-1) );
                        //console.log(index, activate);
                    });
                    /*activate = activate && (patternParts[0].includes(minutes) || patternParts[0].includes(-1));
                    console.log(activate);
                    activate = activate && (patternParts[1].includes(hours) || patternParts[1].includes(-1));
                    console.log(activate);
                    activate = activate && (patternParts[2].includes(day) || patternParts[2].includes(-1));
                    console.log(activate);
                    activate = activate && (patternParts[3].includes(month) || patternParts[3].includes(-1));
                    console.log(activate);
                    activate = activate && (patternParts[4].includes(dayWeek) || patternParts[4].includes(-1));
                    console.log(activate);
                    activate = activate && (patternParts[5].includes(year) || patternParts[5].includes(-1));
                    console.log(activate);*/

                    // tenta uma ultima vez
                    if (!activate) {
                        // se não for pra ser executado, só dá uma testada pra ver se não deveria
                        // já ter sido executado
                        if ((!ev.nextExecution || date.getTime() > ev.nextExecution)
                            && (!ev.lastExecutedAt || ev.lastExecutedAt + 60000 <= date.getTime())) {
                            activate = true;
                            console.log('forcou ativacao do evento', ev);
                        }
                    } else {
                        console.log('ativou evento', ev);
                    }

                    // se cumpriu alguma das exigencias
                    if (activate) {
                        const author = ev.author;
                        const content = ev.content;
                        if (ev.loop) {
                            // se for repetitivo, não deletar e marcar a ultima execucao dele
                            ev.lastExecutedAt = date.getTime();
                            ev.nextExecution = findNextExecution(ev, date).getTime();
                        } else {
                            // deleta o evento se ja foi executado
                            ev = null;
                        }

                        client.fetchUser(author).then(user => {
                            return user.createDM();
                        }).then(dm => {
                            return dm.send(`:alarm_clock: **Evento:** ${content}`);
                        }).then(msgSent => {
                            ref.child('events/' + id).set(ev, err => {
                                if (err) {
                                    console.error(err);
                                    return;
                                }

                                if (ev) {
                                    msgSent.edit(msgSent.content + `\n*próxima execução em ${formatFutureDate(date, ev.nextExecution)}*`);
                                }

                                // deu tudo certo!
                            });
                        }).catch(console.error);
                    }

                }

            });

        } catch (error) {
            console.error(error);
        }
    }

    static commands() {
        return {
            'remindme': RemindMe.remindMeCommand,
            'remind': RemindMe.remindCommand,
            'remindmeplus': RemindMe.remindMeAdvancedCommand
        }
    }

    static timers() {
        return {
            'remindme': RemindMe.remindTimer
        }
    }
}

function interpretEvent(args) {
    let matches = utils.matchAll(args.join(' '), /^(.*?) ([oi]n|every) ([0-9]+ (?:days?|hours?|minutes?|weeks?|months?(?: day [0-9]+)?)|(?:day|hour|minute|week|month(?: day [0-9]+)?)|(?:(?:sun|mon|tues|wednes|thurs|fri|satur)day ?)+|(?:weekend|workdays?)|[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})(?: at (\d{1,2}:\d{1,2}))?$/);

    if (!matches || !matches[0].length) {
        throw new Error('Formato incorreto. Digite \`+remind help\` para mais detalhes.');
    }

    //console.log(matches[0]);
    matches = matches[0];

    const now = new Date();
    const content = matches[1];
    let possibleDates = [];
    let repeatEvent = matches[2] === 'every';
    let at = matches[4] ? matches[4].split(/:/) : [now.getHours(), now.getMinutes()];

    if (matches[3].match(/^[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4}$/)) {
        // data especifica
        if (repeatEvent) {
            throw new Error('Você não pode colocar um evento como `every` se usar uma data específica. Use `in` nesse caso.');
        }

        let [d, m, y] = matches[3].split(/\//);

        // trabalhar anos com 2 digitos
        if (parseInt(y) < 100) {
            y = parseInt(y) + 2000;
        }

        if ((d < 1 && d > 31) || (m < 1 && m > 12) || (y < 1900)) {
            throw new Error('Data ' + matches[3] + ' inválida.');
        }

        possibleDates.push([at[1], at[0], d, m, null, y]);
    } else {
        // sintaxe abstrata
        let quantity = 0;
        let qualitatives = null;
        let monthDay = now.getDate();

        if (matches[3].match(/^[0-9]+ /)) {
            let pts = matches[3].split(/\s/);
            quantity = parseInt(pts.shift());
            qualitatives = pts.join(' ');
        } else {
            qualitatives = matches[3];
        }

        // limitar os espertão que quiser bugar o bot
        if (quantity > 99) {
            throw new Error('Máximo de 99 nos valores.');
        }

        // tratar month com day X
        if (qualitatives.match(/^months? day [0-9]+$/)) {
            const mmatchs = utils.matchAll(qualitatives, /^(months?) day ([0-9]+)$/);
            monthDay = parseInt(mmatchs[0][2]);
            qualitatives = mmatchs[0][1];
        }

        qualitatives = qualitatives.split(/\s/);

        for (let q = 0; q < qualitatives.length; q++) {
            const qualitative = qualitatives[q];
            //console.log('qualitative', qualitative);

            // automaticamente setar pra 1 nesses casos
            if (quantity === 0) {
                switch (qualitative) {
                    case 'minute':
                    case 'hour':
                    case 'day':
                    case 'week':
                    case 'month':
                        quantity = 1;
                }
            }

            switch (qualitative) {
                case 'sunday':
                case 'monday':
                case 'tuesday':
                case 'wednesday':
                case 'thursday':
                case 'friday':
                case 'saturday':
                    const weekDays = {
                        sunday: 0,
                        monday: 1,
                        tuesday: 2,
                        wednesday: 3,
                        thursday: 4,
                        friday: 5,
                        saturday: 6
                    };
                    possibleDates.push([at[1], at[0], null, null, weekDays[qualitative], null]);
                    break;
                case 'weekend':
                    // atalho pra sabado e domingo
                    possibleDates.push([at[1], at[0], null, null, 0, null]);
                    possibleDates.push([at[1], at[0], null, null, 6, null]);
                    break;
                case 'workdays':
                    // atalho pra sabado e domingo
                    possibleDates.push([at[1], at[0], null, null, 1, null]);
                    possibleDates.push([at[1], at[0], null, null, 2, null]);
                    possibleDates.push([at[1], at[0], null, null, 3, null]);
                    possibleDates.push([at[1], at[0], null, null, 4, null]);
                    possibleDates.push([at[1], at[0], null, null, 5, null]);
                    break;
                case 'days':
                case 'day':
                    if (quantity <= 0) {
                        throw new Error('Quantidade de dias incorreto.');
                    }
                    if (repeatEvent) {
                        if (quantity !== 1) {
                            // avisar que não vai rodar como ele quer
                        }
                        for (let d = 1; d <= 31; d += quantity) {
                            possibleDates.push([at[1], at[0], d, null, null, null]);
                        }
                    } else {
                        let dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + quantity);
                        possibleDates.push([at[1], at[0], dt.getDate(), dt.getMonth() + 1, null, dt.getFullYear()]);
                    }
                    break;
                case 'hours':
                case 'hour':
                    if (quantity <= 0) {
                        throw new Error('Quantidade de horas incorreto.');
                    }
                    if (repeatEvent) {
                        for (let h = 0; h <= 23; h += quantity) {
                            possibleDates.push([at[1], h, null, null, null, null]);
                        }
                    } else {
                        let dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + quantity);
                        possibleDates.push([at[1], dt.getHours(), dt.getDate(), dt.getMonth() + 1, null, dt.getFullYear()]);
                    }
                    break;
                case 'minutes':
                case 'minute':
                    if (quantity <= 0 || quantity >= 60) {
                        throw new Error('Quantidade de minutos incorreto. Deve ser entre 1 e 59.');
                    }
                    if (repeatEvent) {
                        if (quantity < 10) {
                            throw new Error('O mínimo para repetição de qualquer evento repetitivo é de **10 minutos**. Eventos não-repetitivos não tem esse limite.');
                        }
                        for (let m = 0; m <= 59; m += quantity) {
                            possibleDates.push([m, null, null, null, null, null]);
                        }
                    } else {
                        let dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + quantity);
                        possibleDates.push([dt.getMinutes(), dt.getHours(), dt.getDate(), dt.getMonth() + 1, null, dt.getFullYear()]);
                    }
                    break;
                case 'weeks':
                case 'week':
                    // bug conhecido: vai rodar no xth dia do mês que corresponder o numero de semanas
                    // ou seja, se rodar a cada 3 semanas, ele vai rodar sempre na primeira semana
                    // e na terceira, independente do mês.
                    if (quantity <= 0 || quantity >= 4) {
                        throw new Error('Quantidade de semanas incorreto. Deve ser entre 1 e 3.');
                    }
                    if (repeatEvent) {
                        let w = 0;
                        for (let d = now.getDate(); d <= 31; d += 7) {
                            if (w++ % quantity === 0) {
                                possibleDates.push([at[1], at[0], d, null, null, null]);
                            }
                        }
                    } else {
                        let dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + quantity * 7);
                        possibleDates.push([at[1], at[0], dt.getDate(), dt.getMonth() + 1, null, dt.getFullYear()]);
                    }
                    break;
                case 'months':
                case 'month':
                    if (quantity <= 0 || quantity > 12) {
                        throw new Error('Quantidade de meses incorreto. Deve ser entre 1 e 12.');
                    }
                    if (monthDay <= 0 || monthDay > 31) {
                        throw new Error('Quantidade do dia do mês incorreto. Deve ser entre 1 e 31.');
                    }
                    if (repeatEvent) {
                        for (let m = 1; m <= 12; m += quantity) {
                            possibleDates.push([at[1], at[0], monthDay, m, null, null]);
                        }
                    } else {
                        let y = now.getFullYear();
                        let m = now.getMonth() + quantity;
                        while (m > 11) {
                            m -= 12;
                            y++;
                        }
                        let dt = new Date(y, m, now.getDate());
                        possibleDates.push([at[1], at[0], dt.getDate(), dt.getMonth() + 1, null, dt.getFullYear()]);
                    }
                    break;
            }
        }

    }

    //console.log(possibleDates);

    if (!possibleDates.length) {
        throw new Error('A expressão `' + matches[0] + '` não conseguiu formar uma sintaxe, apesar de estar correta.');
    }

    let syntax = [];

    for (let i = 0; i < possibleDates.length; i++) {
        const possibleDate = possibleDates[i];

        // filtra se a data está no passado
        if (isPast(possibleDate, now) && !repeatEvent) {
            throw new Error('A expressão `' + matches[0] + '` tem datas que estão no passado.');
        }

        // 0 = min
        // 1 = hour
        // 2 = daymonth
        // 3 = month
        // 4 = dayweek
        // 5 = year
        for (let y = 0; y < 6; y++) {
            syntax[y] = syntax[y] || [];

            if (possibleDate[y] !== null) {
                syntax[y].push(possibleDate[y]);
            }
        }
    }

    // unique
    for (let y = 0; y < 6; y++) {
        let arrayUnique = utils.uniqueArray(syntax[y]);
        syntax[y] = arrayUnique.length ? arrayUnique.join(',') : '*';
    }

    syntax = syntax.join(' ');

    return [content, syntax, repeatEvent, matches[0].substr(content.length + 1)];
}

function parsePattern(pattern) {
    let patternParts = pattern.split(/\s/);

    return patternParts.map(item => {
        let units = item.split(/,/);
        let newUnits = [];
        units.forEach(unit => {
            if (unit.indexOf('-') !== -1) {
                let [min, max] = unit.split(/-/);
                if (min > max) {
                    throw new Error('Erro no pattern "' + pattern + '". Valor min não pode ser maior que max.');
                }
                for (let u = parseInt(min); u <= parseInt(max); u++) {
                    newUnits.push(u);
                }
            } else if (unit.indexOf('/') !== -1) {
                throw new Error('Erro no pattern "' + pattern + '". Valor com / não suportado.');
            } else if (unit === '*') {
                newUnits.push(-1);
            } else {
                newUnits.push(parseInt(unit));
            }

        });
        return newUnits;
    });
}

function findNextExecution(event, now) {
    // força a data ser no segundo zero
    now.setSeconds(0);
    now.setMilliseconds(0);

    let nextDate = new Date(now.getTime());
    let patternParts = parsePattern(event.pattern);

    if (event.loop) {
        // soma 1 minuto pra não pegar o mesmo momento
        //nextDate.setTime(nextDate.getTime() + 60000);

        let sum = 60;
        for (let n = 0; n < 6; n++) {
            if (patternParts[n].length > 1 || (n === 4 && !patternParts[n].includes(-1))) {
                if (n === 1) { sum = 3600; } // por hora
                if (n === 2 || n === 4) { sum = 86400; } // por dia
                if (n === 3) { sum = 2592000; } // (mes) por mes
                if (n === 5) { sum = 2592000; } // (ano) por mes

                // a diferença vai ser a multiplicacao da soma
                // todo: necessario?

                break;
            }
        }
        sum *= 1000;
        let activate = false;
        let first = true;
        let limitLoop = 1000;

        while (limitLoop--) {
            activate = true;

            let tests = [nextDate.getMinutes(), nextDate.getHours(), nextDate.getDate(), nextDate.getMonth() + 1, nextDate.getDay(), nextDate.getFullYear()];
            tests.forEach((value, index) => {
                activate = activate
                    && (   patternParts[index].includes(value)
                        || patternParts[index].includes(-1) );
                //console.log(index, patternParts[index], value, activate);
            });

            if (activate && !first) {
                break;
            }

            nextDate.setTime(nextDate.getTime() + sum);
            // acerta o que ficou destoado
            for (let n = 0; n < 6; n++) {
                if (patternParts[n].length === 1 && patternParts[n][0] !== -1) {
                    if (n === 0) { nextDate.setMinutes(patternParts[n][0]); } // minuto
                    if (n === 1) { nextDate.setHours(patternParts[n][0]); } // hora
                    if (n === 2 && !patternParts[4].includes(-1)) { nextDate.setDate(patternParts[n][0]); } // dia
                    if (n === 3) { nextDate.setMonth(patternParts[n][0] - 1); } // mes
                }
            }
            first = false;
        }

        if (limitLoop === 0) {
            throw new Error('Não foi possível encontrar a próxima execução desse evento.');
        }

    } else {
        // seta minutos
        if (patternParts[0][0] && patternParts[0][0] !== -1) {
            nextDate.setMinutes(patternParts[0][0]);
        }

        // horas
        if (patternParts[1][0] && patternParts[1][0] !== -1) {
            nextDate.setHours(patternParts[1][0]);
        }

        // dia
        if (patternParts[2][0] && patternParts[2][0] !== -1) {
            nextDate.setDate(patternParts[2][0]);
        }

        // month
        if (patternParts[3][0] && patternParts[3][0] !== -1) {
            nextDate.setMonth(patternParts[3][0] - 1);
        }

        // ano
        if (patternParts[5][0] && patternParts[5][0] !== -1) {
            nextDate.setFullYear(patternParts[5][0]);
        }
    }

    return nextDate;
}

function isPast(patternParts, date) {
    // ano
    if (patternParts[5] !== null && patternParts[5] < date.getFullYear()) {
        return true;
    }

    // se o ano foi preenchido e ele é maior ou igual ao atual, entao faz sentido ver mês
    if (patternParts[5] !== null && parseInt(patternParts[5]) === date.getFullYear()) {
        // mes
        if (patternParts[3] !== null && patternParts[3] < (date.getMonth() + 1)) {
            return true;
        }

        // faz o mesmo com o mês
        if (patternParts[3] === null ||
            (patternParts[3] !== null && parseInt(patternParts[3]) === (date.getMonth() + 1))) {

            // dia
            if (patternParts[2] !== null && patternParts[2] < date.getDate()) {
                return true;
            }

            // o mesmo com o dia
            if (patternParts[2] === null ||
                (patternParts[2] !== null && parseInt(patternParts[2]) === date.getDate())) {

                // hora
                if (patternParts[1] !== null && patternParts[1] < date.getHours()) {
                    return true;
                }

                // o mesmo com a hora
                if (patternParts[1] !== null && parseInt(patternParts[1]) === date.getHours()) {

                    // minutos
                    if (patternParts[0] !== null && patternParts[0] <= date.getMinutes()) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

function formatFutureDate(now, future) {
    const diff = parseInt((future instanceof Date ? future.getTime() : future) / 1000)
        - parseInt((now instanceof Date ? now.getTime() : now) / 1000);

    if (diff < 0) {
        return 'um momento';
    }

    return formatTime(diff);
}

function formatTime(seconds) {
    if (seconds > 3600) {
        if (seconds > 2592000) {
            return parseInt(seconds / 2592000) + ' mes(es)';
        }
        if (seconds > 86400) {
            return parseInt(seconds / 86400) + ' dia(s)';
        }
        const minutes = parseInt((seconds % 3600) / 60);
        const minutesText = minutes > 0 ? ` e ${minutes} minuto(s)` : '';
        return parseInt(seconds / 3600) + ' hora(s)' + minutesText;
    }

    if (seconds > 60) {
        return parseInt(seconds / 60) + ' minuto(s)';
    }

    return parseInt(seconds) + ' segundo(s)';
}

module.exports = RemindMe;