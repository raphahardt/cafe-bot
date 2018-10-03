
const Cafebase = require('./Cafebase');

/**
 * Fiz esse módulo pra poder ativar e desativar módulos do bot online
 * quando precisar.
 *
 * Preciso disso nos casos de eu querer testar uma funcionalidade nova
 * num módulo que já está rodando, e quando eu rodo ele local o bot acaba
 * "duplicando" a função do módulo em si. Então, com esse módulo,
 * eu vou conseguir desativar uma parte do bot que eu quero testar
 * e rodar localmente sem ter que desativar o bot por completo na aws
 * (que é um saco fazer kkk)
 */
class ModuleActivator {
    constructor (_debug) {
        this.blacklistModules = {};
        this._debug = !!_debug;

        if (!this._debug) {
            this.db = new Cafebase('modules');

            const activator = this;
            this.db.getLiveCollection('blacklist', (event, ignore, moduleName) => {
                if (event === 'added') {
                    activator.blacklistModules[moduleName] = true;
                } else if (event === 'removed') {
                    delete activator.blacklistModules[moduleName];
                }
            });
        }

        this.modulesInstalled = {};
    }

    // esse módulo é o unico q não tem nome e não pode ser desativado
    static get modName() { return false }

    /**
     * Adiciona um módulo no pool de módulos.
     *
     * @param module
     */
    installModule(module) {
        if (module.modName) {
            this.modulesInstalled[module.modName] = new module();
        }
    }

    /**
     * Itera sobre os metodos de um módulo.
     *
     * @param method Valores possíveis: commands, timers, events
     * @param includeDisableds
     */
    *iterateModules(method, includeDisableds) {
        for (let moduleName in this.modulesInstalled) {
            if (!this.modulesInstalled.hasOwnProperty(moduleName)) continue;
            const module = this.modulesInstalled[moduleName];

            if (!includeDisableds && this.isDisabled(moduleName)) {
                // modulo desabilitado, não considerar
                console.log('DISABLED');
                continue;
            }

            const methodsAvailable = module[method] !== undefined ? module[method]() : {};
            if (typeof methodsAvailable !== 'object') {
                throw new Error('Method ' + method + '() of class ' + module.name + ' must return an object.');
            }

            for (let m in methodsAvailable) {
                if (!methodsAvailable.hasOwnProperty(m)) continue;

                // todo: fazer suporte pra mais de um argumento aqui (talvez retornar um array do modulo, onde o 0 é a fn e 1 é outra coisa)
                let fn, opts = {};
                if (Array.isArray(methodsAvailable[m])) {
                    fn = methodsAvailable[m][0];
                    opts = methodsAvailable[m][1];
                } else {
                    fn = methodsAvailable[m];
                }

                yield [module, m, fn, opts];
            }
        }
    }

    /**
     * Retorna true se o módulo está desativado.
     *
     * @param moduleName
     * @returns {boolean}
     */
    isDisabled(moduleName) {
        if (!moduleName || this._debug) {
            // se o nome do modulo for vazio, ele sempre vai estar ativo
            return false;
        }
        return !!this.blacklistModules[moduleName];
    }

    /**
     * Ativa/desativa um módulo do sistema.
     *
     * @param message
     * @param args
     */
    modCommand(message, args) {
        if (message.author.id !== '208028185584074763' || this._debug) return;

        args.forEach(arg => {
            const moduleName = arg.toLowerCase();
            const module = this.modulesInstalled[moduleName];
            if (!module) {
                return message.reply(`:x: Módulo **${moduleName}** não existe.`);
            }
            if (this.isDisabled(moduleName)) {
                // ativa
                this.db.save('blacklist/' + moduleName, null)
                    .then(() => {
                        if (module.onEnable) module.onEnable();
                        return message.reply(`:full_moon_with_face: Módulo **${moduleName}** ativado.`);
                    })
                ;
            } else {
                // desativa
                this.db.save('blacklist/' + moduleName, 1)
                    .then(() => {
                        if (module.onDisable) module.onDisable();
                        return message.reply(`:new_moon_with_face: Módulo **${moduleName}** desativado.`);
                    })
                ;
            }
        })
    }

    /**
     * Lista os módulos que estão desativos no momento.
     *
     * @param message
     * @param args
     * @returns {Promise<Message|Message[]>|*}
     */
    modsCommand(message, args) {
        if (this._debug) return;

        const blMods = Object.keys(this.blacklistModules);
        if (!blMods.length) {
            return message.reply(`:full_moon: Todos os módulos estão ativos.`);
        }
        const modsInst = Object.keys(this.modulesInstalled);
        const modulesText = blMods.join('**, **');
        const emojis = [
            ':full_moon:',
            ':waning_gibbous_moon:',
            ':last_quarter_moon:',
            ':waning_crescent_moon:',
            ':new_moon:'
        ];
        const idx = Math.round((blMods.length / Math.max(1, modsInst.length)) * 4);
        return message.reply(`${emojis[idx]} Módulos desativados no momento: **${modulesText}**.`);
    }

    commands() {
        if (this._debug) {
            // desabilita qualquer possibilidade de
            // conflito desses comandos, se tiver testando localmente
            return {};
        }
        return {
            'mod': this.modCommand,
            'mods': this.modsCommand
        }
    }
}

module.exports = ModuleActivator;