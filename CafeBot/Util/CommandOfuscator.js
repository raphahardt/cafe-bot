const Discord = require("discord.js");

/**
 * Decorator para alterar todos os comandos de um módulo
 * colocando _ na frente de cada um.
 * Isso serve pra eu poder usar um módulo ao mesmo tempo
 * em produção e em dev sem conflitar comandos.
 */
class CommandOfuscator {
    constructor(module) {
        this.module = module;
    }

    get modName() { return '_' + this.module.modName; }

    commands() {
        if (!this.module.commands) {
            return {};
        }
        const commands = this.module.commands();
        let ofuscatedCommands = {};
        for (let cmd in commands) {
            if (commands.hasOwnProperty(cmd)) {
                ofuscatedCommands['_' + cmd] = commands[cmd];
            }
        }
        return ofuscatedCommands;
    }

    events() {
        return {};
    }

    timers() {
        return {};
    }
}

module.exports = CommandOfuscator;