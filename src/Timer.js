const { oneLine } = require('common-tags');

class Timer {
    constructor(client, info) {
        /**
         * Client that this command is for
         * @name Command#client
         * @type {CommandoClient}
         * @readonly
         */
        Object.defineProperty(this, 'client', { value: client });

        /**
         * Name
         * @type {string}
         */
        this.name = info.name;

        /**
         * ID of the group the command belongs to
         * @type {string}
         */
        this.groupID = info.group;

        /**
         * The group the command belongs to, assigned upon registration
         * @type {?CommandGroup}
         */
        this.group = null;

        /**
         * Datas/horas que o timer vai ser disparado, ou TRUE para disparar infinitamente a cada 1 minuto
         * @type {string[]|boolean}
         */
        this.triggers = info.triggers || [];
    }

    /**
     * Roda o timer
     * @param {Date} date - A data/hora atual
     * @return {Promise<?Message|?Array<Message>>}
     * @abstract
     */
    async run(date) { // eslint-disable-line no-unused-vars, require-await
        throw new Error(`${this.constructor.name} doesn't have a run() method.`);
    }

    /**
     * Verifica se já está na hora de rodar esse timer, de acordo com a data/hora atual
     *
     * @param {Date} date - A data/hora atual
     * @returns {boolean}
     */
    isTimeToTrigger(date) {
        if (this.triggers === true) return true;
        // TODO: verificar os triggers
        return false;
    }
}

module.exports = Timer;