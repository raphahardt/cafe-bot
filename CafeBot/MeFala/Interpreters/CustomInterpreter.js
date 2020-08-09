
const Cafebase = require('../../Cafebase');

/**
 * Esse interpreter vai ler o banco de dados e vai responder com as alternativas
 * gravadas nesse banco. É o interpreter onde os membros do grupo poderão criar
 * seus próprios "mefala"s
 *
 */
module.exports = class CustomInterpreter {
    constructor() {}

    static async init() {
        if (this._initialized) {
            return;
        }
        const db = new Cafebase('mefala');

        this.items = await db.getArray('custom-interpreters');
        this._initialized = true;
    }

    static interpret(user, questionPhrase, mentions) {
        this.itemSelected = null;

        for (const item of this.items) {
            if (questionPhrase.match(new RegExp(item.pattern, 'i'))) {
                this.itemSelected = item;
                return true;
            }
        }

        return false;
    }

    static get priority() { return 1000 };

    static phrases(user, questionPhrase, mentions) {
        if (!this.itemSelected) {
            return [];
        }

        if (this.itemSelected.userPhrases) {
            for (const userId in this.itemSelected.userPhrases) {
                if (!this.itemSelected.userPhrases.hasOwnProperty(userId)) continue;

                if (userId === user.id || userId === user.username) {
                    return this.itemSelected.userPhrases[userId];
                }
            }
        }

        return this.itemSelected.phrases || [];
    }
};
