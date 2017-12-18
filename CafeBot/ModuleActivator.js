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
    constructor () {
        this.blacklistModules = [];
    }

    // esse módulo é o unico q não tem nome e não pode ser desativado
    static get name() { return false }

    isDisabled(moduleName) {
        if (!moduleName) {
            // se o nome do modulo for vazio, ele sempre vai estar ativo
            return false;
        }
        return this.blacklistModules.includes(moduleName);
    }

    modCommand(message, args) {
        if (message.author.id.toString() !== '208028185584074763'
            || message.author.id.toString() !== '164083196999237633'
            || message.author.id.toString() !== '132137996995526656') return;

        args.forEach(arg => {
            const moduleName = arg.toLowerCase();
            if (this.isDisabled(moduleName)) {
                // ativa
                this.blacklistModules.splice(this.blacklistModules.indexOf(moduleName), 1);
                message.channel.send(`Módulo **${moduleName}** ativado.`);
            } else {
                // desativa
                this.blacklistModules.push(moduleName);
                message.channel.send(`Módulo **${moduleName}** desativado.`);
            }
        })
    }

    modsCommand(message, args) {
        const modules = this.blacklistModules.join('**, **');
        if (!modules) {
            message.channel.send(`Todos os módulos estão ativos.`);
            return;
        }
        message.channel.send(`Módulos desativados no momento: **${modules}**.`);
    }

    commands() {
        return {
            'mod': this.modCommand,
            'mods': this.modsCommand
        }
    }
}

module.exports = ModuleActivator;