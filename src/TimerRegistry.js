const path = require('path');
const discord = require('discord.js');
const Timer = require('./Timer');

class TimerRegistry {
    /** @param {CommandoClient} [client] - Client to use  */
    constructor(client) {
        /**
         * The client this registry is for
         * @name CommandRegistry#client
         * @type {CommandoClient}
         * @readonly
         */
        Object.defineProperty(this, 'client', { value: client });

        /**
         * Registered timers
         * @type {Collection<string, Timer>}
         */
        this.timers = new discord.Collection();

        /**
         * Fully resolved path to the bot's timers directory
         * @type {?string}
         */
        this.timersPath = null;
    }

    /**
     * Registers a single timer
     * @param {Timer|Function} timer - Either a Timer instance, or a constructor for one
     * @return {TimerRegistry}
     * @see {@link TimerRegistry#registerTimers}
     */
    registerTimer(timer) {
        return this.registerTimers([timer]);
    }

    /**
     * Registers multiple timers
     * @param {Timer[]|Function[]} timers - An array of Timer instances or constructors
     * @return {TimerRegistry}
     */
    registerTimers(timers) {
        if(!Array.isArray(timers)) throw new TypeError('Timers must be an Array.');
        for(let timer of timers) {
            if(typeof timer === 'function') timer = new timer(this.client); // eslint-disable-line new-cap

            // Verify that it's an actual timer
            if(!(timer instanceof Timer)) {
                this.client.emit('warn', `Attempting to register an invalid timer object: ${timer}; skipping.`);
                continue;
            }

            // Make sure there aren't any conflicts
            if(this.timers.some(tmr => tmr.name === timer.name || tmr.aliases.includes(timer.name))) {
                throw new Error(`A timer with the name "${timer.name}" is already registered.`);
            }
            const group = this.client.registry.groups.find(grp => grp.id === timer.groupID);
            if(!group) throw new Error(`Group "${timer.groupID}" is not registered.`);

            // Add the timer
            timer.group = group;
            this.timers.set(timer.name, timer);
            /**
             * Emitted when a timer is registered
             * @event CommandoClient#timerRegister
             * @param {Timer} timer - Timer that was registered
             * @param {TimerRegistry} registry - Registry that the timer was registered to
             */
            //this.client.emit('timerRegister', timer, this);
            //this.client.emit('debug', `Registered timer ${group.id}:${timer.name}.`);
        }

        return this;
    }

    /**
     * Registers all timers in a directory. The files must export a Timer class constructor or instance.
     * @param {string|RequireAllOptions} options - The path to the directory, or a require-all options object
     * @return {TimerRegistry}
     */
    registerTimersIn(options) {
        const obj = require('require-all')(options);
        const timers = [];
        for(const group of Object.values(obj)) {
            for(let timer of Object.values(group)) {
                if(typeof timer.default === 'function') timer = timer.default;
                timers.push(timer);
            }
        }
        if(typeof options === 'string' && !this.timersPath) this.timersPath = options;
        return this.registerTimers(timers);
    }

    /**
     * Unregisters a timer
     * @param {Timer} timer - Timer to unregister
     */
    unregisterTimer(timer) {
        this.timers.delete(timer.name);
        /**
         * Emitted when a timer is unregistered
         * @event CommandoClient#timerUnregister
         * @param {Timer} timer - Timer that was unregistered
         */
        // this.client.emit('timerUnregister', timer);
        // this.client.emit('debug', `Unregistered timer ${timer.groupID}:${timer.name}.`);
    }

    /**
     * Inicia os timers
     */
    start() {
        this.client.setInterval(() => {
            // ignora se o client ainda não tiver pronto
            if (!this.client.readyAt) return;

            let date = new Date();
            date.setSeconds(0, 0);

            for(const timer of this.timers.values()) {
                if (timer.isTimeToTrigger(date)) {
                    timer.run(date);
                }
            }
        }, 60000);
    }
}

module.exports = TimerRegistry;
