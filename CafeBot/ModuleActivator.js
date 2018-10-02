
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
                console.log('MODULE', moduleName);
                if (event === 'added') {
                    activator.blacklistModules[moduleName] = true;
                } else if (event === 'removed') {
                    activator.blacklistModules[moduleName] = false;
                }
            });
        }

        this.modulesInstalled = {};
    }

    // esse módulo é o unico q não tem nome e não pode ser desativado
    static get name() { return false }

    isDisabled(moduleName) {
        if (!moduleName || this._debug) {
            // se o nome do modulo for vazio, ele sempre vai estar ativo
            return false;
        }
        return !!this.blacklistModules[moduleName];
    }

    modCommand(message, args) {
        if (message.author.id !== '208028185584074763' || this._debug) return;

        args.forEach(arg => {
            const moduleName = arg.toLowerCase();
            //const module = this.modulesInstalled[moduleName];
            if (this.isDisabled(moduleName)) {
                // ativa
                //this.blacklistModules.splice(this.blacklistModules.indexOf(moduleName), 1);
                this.db.save('blacklist/' + moduleName, 1)
                    .then(() => {
                        //if (module.onEnable) module.onEnable();
                        return this.template(message, `Módulo **${moduleName}** ativado.`);
                    })
                ;
            } else {
                // desativa
                //this.blacklistModules.push(moduleName);
                this.db.save('blacklist/' + moduleName, null)
                    .then(() => {
                        //if (module.onDisable) module.onDisable();
                        return this.template(message, `Módulo **${moduleName}** desativado.`);
                    })
                ;
            }
        })
    }

    modsCommand(message, args) {
        if (this._debug) return;

        const blMods = Object.keys(this.blacklistModules);
        if (!blMods.length) {
            return this.template(message, 'Todos os módulos estão ativos.');
        }
        const modulesText = blMods.join('**, **');
        return this.template(message, `Módulos desativados no momento: **${modulesText}**.`);
    }

    template(message, text) {
        return message.reply(`:space_invader: ${text}`);
    }

    commands() {
        if (this._debug) {
            return {};
        }
        return {
            'amod': this.modCommand,
            'amods': this.modsCommand
        }
    }
}

module.exports = ModuleActivator;