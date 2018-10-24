const Discord = require("discord.js");
const Cafebase = require("./Cafebase");
const utils = require("../utils");

const PermissionError = require("./Errors/PermissionError");

const bot = {
    // auto-explicativo
    packageJson: {},
    ready: false,
    debug: false,
    cafeComPaoGuildId: "213797930937745409",

    // cache de quem usou um comando pra evitar flood de comandos
    commandsLastUsed: {},

    /**
     * Registra os eventos e comandos de um listener.
     *
     * @param {Discord.Client} discordClient
     * @param {ModuleActivator} modules
     * @param {Array} listeners
     */
    registerDiscordEvents: (discordClient, modules, listeners) => {
        // debug
        bot.debug = modules._debug;

        // registrando os modulos no moduleActivator
        listeners.forEach(listener => {
            modules.installModule(listener);
        });

        discordClient.setInterval(() => {
            // se o bot ainda não estiver ready, nem executa
            if (!bot.ready) return;

            const dateNow = new Date();

            // invocando os eventos v2
            for (let o of modules.iterateModules("timers")) {
                const [module, key, fn, opts] = o;

                console.log(`${module.modName} | timer triggered ${key}`);

                // executa o evento de fato
                try {
                    const r = fn.apply(module, [
                        discordClient,
                        dateNow.getSeconds(),
                        dateNow.getMinutes(),
                        dateNow.getHours(),
                        dateNow.getDate(),
                        dateNow.getMonth() + 1,
                        dateNow.getDay(),
                        dateNow.getFullYear(),
                        dateNow
                    ]);

                    handlePromiseReturn(r, discordClient, bot.debug);
                } catch (error) {
                    handleError(error, discordClient, bot.debug);
                }
            }

        }, 60000);

        // ready
        discordClient.on("ready", () => {
            bot.ready = true;

            console.log(`Bot ${bot.packageJson.name} v${bot.packageJson.version} [${discordClient.users.size} membros] [${discordClient.channels.size} canais] [${discordClient.guilds.size} servers]`);

            // sai de todas as guilds q não seja o café com pão
            discordClient.guilds.forEach((guild) => {
                if (guild.id !== "213797930937745409") {
                    guild.leave();
                }
            });

            const phrases = utils.shuffle(["você tomar café", "os ghosts safados", "seus abcs"]);
            discordClient.user.setActivity(`${phrases[0]} (${bot.packageJson.version})` + (modules._debug ? " (testes)" : ""), { type: "WATCHING" });

            if (!bot.debug) {
                // procura o canal pra mandar as mensagens pinnadas
                const logChannel = discordClient.channels.get("240297584420323338");
                if (logChannel) {
                    const emb = new Discord.RichEmbed()
                        .setColor(0x3498db)
                        .setTitle(`Café bot v${bot.packageJson.version}`)
                        .setDescription(`Conectado no server`)
                        .setTimestamp(new Date());

                    logChannel.send({embed: emb});
                }
            }

        });

        // registra o evento de erros.
        // necessário, para não crashar o node.
        // visto em: https://nodejs.org/dist/latest/docs/api/events.html#events_error_events
        discordClient.on("error", error => {
            handleError(error, discordClient, bot.debug);
        });

        // ver: https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-rateLimit
        // fix: não é necessário ficar olhando se o bot atingiu os rate limits do Discord,
        // pois o proprio discord.js já lida com isso (e eles são obrigados a fazer isso para
        // serem qualificados de serem uma das bibliotecas reconhecidas pelo proprio Discord)
        // para entender, ver: https://github.com/discordjs/discord.js/issues/1176
        discordClient.on("rateLimit", info => {
            //handleError(new Error('Rate limit: ' + JSON.stringify(info)), discordClient, bot.debug);
        });

        // evento pros comandos
        discordClient.on("message", message => {
            if (message.author.bot) return;

            // ignora qualquer mensagem que não começar com o prefixo
            // e ignora tambem caso o comando for passado com espaço entre o prefixo e o comando
            if (message.content.indexOf(utils.prefix) !== 0
                || message.content.charAt(utils.prefix.length) === ' ') return;

            // pega o comando
            let argsString = message.content.slice(utils.prefix.length).trim();
            const args = parseArgs(argsString);
            const command = args.shift().toLowerCase();

            // invocando os comandos v2
            for (let o of modules.iterateModules("commands")) {
                const [module, cmd, fn, opts] = o;
                //console.log('FN', typeof(fn));

                if (command === cmd) {
                    console.log(`${module.modName} | invoking ${command}`, args);
                    // chama o comando do listener registrado
                    try {
                        let a = [message, args];
                        if (opts.guild) {
                            const guild = getCafeComPaoGuildAndCheck(message, opts);
                            // coloca a guild como primeiro argumento
                            a = [guild].concat(a);
                        }

                        if (opts.disallowDM) {
                            if (message.channel instanceof Discord.DMChannel) {
                                message.reply(`:no_entry_sign: Este comando só pode ser usado dentro do servidor.`);
                                continue;
                            }
                        }

                        const r = fn.apply(module, a);
                        handlePromiseReturn(r, message, bot.debug);
                    } catch (error) {
                        handleError(error, message, bot.debug);
                    }
                }
            }
        });

        // invocando os eventos v2
        for (let o of modules.iterateModules("events", true)) {
            const [module, event, fn, opts] = o;

            console.log(`${module.modName} | event registered ${event}`);

            // registra um evento no client do discord
            // antigo código: discordClient.on(event, events[event]);
            discordClient.on(event, (...args) => {
                // hook pra ver se o modulo tá desativado ou não
                if (modules.isDisabled(module.modName)) {
                    console.log(`${module.modName} | tried execute event ${event} but module is disabled`);
                    return;
                }

                // só em alguns eventos, mandar o client nos argumentos, pra facilitar
                // minha vida na hora de pegar o client do discord
                if (event === "ready") {
                    args = [discordClient].concat(args);
                } else {
                    if (opts.guild) {
                        const guild = getCafeComPaoGuildAndCheck(discordClient, opts);
                        // coloca a guild como primeiro argumento
                        args = [guild].concat(args);
                    }
                }

                // executa o evento de fato
                try {
                    const r = fn.apply(module, args);
                    handlePromiseReturn(r, discordClient, bot.debug);
                } catch (error) {
                    handleError(error, discordClient, bot.debug);
                }
            });
        }
    }
};

/**
 * Separa os argumentos em um array. Se tiver entre aspas, ele
 * considera sendo uma parte do string
 *
 * @param string
 */
function parseArgs(string) {
    if (string.indexOf("\"") >= 0) {
        // tira os espaços repetidos, primeiro de tudo
        string = string.replace(/\s+/g, " ");

        let args = [];
        let insideQuote = false, argIdx = 0;
        for (let i = 0; i < string.length; i++) {
            const char = string.charAt(i);

            switch (char) {
                case " ":
                    if (!insideQuote) {
                        argIdx++;
                    }
                    break;
                case "\"":
                    insideQuote = !insideQuote;
                    continue;
            }

            if (!args[argIdx]) {
                args[argIdx] = "";
            }
            args[argIdx] += char;
        }

        return args.map(e => e.trim()).filter(e => e.length > 0);
    }
    // uma pequena otimização no caso de não ter nenhuma aspas, não faz sentido
    // correr a string inteira todas as vezes
    return string.split(/\s+/g);
}

/**
 * Faz log do erro, responde pro usuário (se possível) e manda
 * uma DM pra mim com o erro.
 *
 * @param {Error|string} error
 * @param {Discord.Message|Discord.Client} messageOrClient
 * @param {Boolean} _debug
 */
function handleError(error, messageOrClient, _debug) {
    // primeiro de tudo, manda pro log do servidor
    console.error(error);

    let message, client;
    if (messageOrClient instanceof Discord.Message) {
        message = messageOrClient;
        client = messageOrClient.client;
    } else {
        client = messageOrClient;
    }

    if (message) {
        // handler
        if (error instanceof PermissionError) {
            // se for erro de permissão, só mostrar pro usuário
            const msg = error.message || "Você não tem permissão para usar este comando.";
            message.reply(`:no_entry_sign: ${msg}`);
            return;
        }

        // se tiver sido num canal, responder pro usuário com o erro
        message.reply(`:x: ${error}`);
    }

    if (!_debug) {
        // me avisa
        client.fetchUser("208028185584074763", false)
            .then(me => {
                return me.createDM();
            })
            .then(dm => {
                if (error instanceof Error) {
                    return utils.sendLongMessage(dm, `:x: ${error.stack}`);
                }
                return dm.send(`:x: ${error}`);
            })
            .catch(err => {}) // ignora os erros de me avisar, qq coisa eu olho direto no log
        ;
    }
}

/**
 * Se o retorno de um dos métodos dos módulos for um Promise,
 * então tenta capturar o erro e manda pro handleError().
 *
 * @param {any} r
 * @param {Discord.Message|Discord.Client} messageOrClient
 * @param {Boolean} _debug
 */
function handlePromiseReturn(r, messageOrClient, _debug) {
    if (r instanceof Promise) {
        // esse catch não vai ser executado
        // se o promise que foi retornado já tiver um catch
        // isso é util pois posso capturar o erro no proprio
        // modulo e controlar quando ou não eu quero mandar
        // o log de erros por dm
        // visto em: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch#Using_and_chaining_the_catch_method
        r.catch((error) => {
            handleError(error, messageOrClient, _debug);
        })
    }
}

/**
 *
 * @param {Discord.Message|Discord.Client} messageOrClient
 * @param {object} opts
 * @returns {Discord.Guild}
 */
function getCafeComPaoGuildAndCheck(messageOrClient, opts) {
    let guild;
    if (messageOrClient instanceof Discord.Message) {
        guild = messageOrClient.guild || messageOrClient.client.guilds.get(bot.cafeComPaoGuildId);
    } else {
        guild = messageOrClient.guilds.get(bot.cafeComPaoGuildId);
    }

    if (!opts.noGuildCheck) {
        if (!guild || !guild.available) {
            throw new Error(`Guild com problema.`);
        }
    }

    return guild;
}

module.exports = (packageJson) => {
    bot.packageJson = packageJson;
    return bot;
};