const commando = require('discord.js-commando');
// const { oneLine } = require('common-tags');

module.exports = class CountCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'count',
            group: 'basic',
            memberName: 'count',
            description: 'Conta números sempre que for chamado, começando do 1.',
            examples: ['count'],
        });

        this.count = 0;
    }

    async run(msg, args ) {
        this.count++;
        return msg.reply(`${this.count}`);
    }
};