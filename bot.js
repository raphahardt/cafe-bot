/*! cafe-bot by Raphael Hardt */
/* eslint-disable no-console */
const commando = require('discord.js-commando');
const { oneLine } = require('common-tags');
const path = require('path');
const auth = require('./auth');
const packageCfg = require("./package.json");

const fbApp = require('./firebase-app');
const FirebaseProvider = require('./src/FirebaseProvider');

const TimerRegistry = require('./src/TimerRegistry');

const client = new commando.Client({
    owner: auth.owner,
    commandPrefix: auth.prefix
});

client
    .on('error', console.error)
    .on('warn', console.warn)
    .on('debug', console.log)
    .on('ready', () => {
        console.log(`Client ready; logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`);
    })
    .on('disconnect', () => { console.warn('Disconnected!'); })
    .on('reconnecting', () => { console.warn('Reconnecting...'); })
    .on('commandError', (cmd, err) => {
        if(err instanceof commando.FriendlyError) return;
        console.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
    })
    .on('commandBlocked', (msg, reason) => {
        console.log(oneLine`
			Command ${msg.command ? `${msg.command.groupID}:${msg.command.memberName}` : ''}
			blocked; ${reason}
		`);
    })
    .on('commandPrefixChange', (guild, prefix) => {
        console.log(oneLine`
			Prefix ${prefix === '' ? 'removed' : `changed to ${prefix || 'the default'}`}
			${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
		`);
    })
    .on('commandStatusChange', (guild, command, enabled) => {
        console.log(oneLine`
			Command ${command.groupID}:${command.memberName}
			${enabled ? 'enabled' : 'disabled'}
			${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
		`);
    })
    .on('groupStatusChange', (guild, group, enabled) => {
        console.log(oneLine`
			Group ${group.id}
			${enabled ? 'enabled' : 'disabled'}
			${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
		`);
    });

client.setProvider(new FirebaseProvider(fbApp)).catch(console.error);

client.registry
    .registerDefaultTypes()
    .registerGroups([
        ['basic', 'Básicos'],
        ['othergames', 'Jogos diversos'],
    ])
    .registerTypesIn(path.join(__dirname, 'types'))
    .registerCommandsIn(path.join(__dirname, 'commands'));

const timerRegistry = new TimerRegistry(client);
timerRegistry.registerTimersIn(path.join(__dirname, 'timers'))
timerRegistry.start();

client.login(auth.token).catch(console.error);