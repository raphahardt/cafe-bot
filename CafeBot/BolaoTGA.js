
const utils = require('../utils');
let insideCount = {};

const Cafebase = require('./Cafebase');
const InteractivePrompt = require('./Util/InteractivePrompt');

// cache da ultima vez q foi usado um comando, pra evitar spam de comandos
let LAST_USED = {};

class BolaoTGA {
    constructor () {
        this.db = new Cafebase('tga');
    }

    get modName() { return 'tga' }

    async tgaCommand(message, args) {
        
    }

    commands() {
        return {
            'tga': this.tgaCommand,
            'tga-admin': this.tgaAdminCommand,
        }
    }
}

module.exports = BolaoTGA;