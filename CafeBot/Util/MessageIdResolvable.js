const Discord = require("discord.js");
const levenshtein = require("fast-levenshtein");

/*
[ '<@!388352985778094082>', user
  '<#240297584420323338>', channel
  '<@&255674047034032129>' role
  ]

 */
class MessageIdResolvable {
    constructor(message, args, clearFromArgs) {
        if (clearFromArgs === undefined) clearFromArgs = true;
        this.message = message;
        this.args = args;
        this.clearFromArgs = clearFromArgs;
    }

    /**
     * Encontra o elemento mais próximo de um texto, em um collection.
     *
     * @param collection
     * @param comparisonTexts
     * @param arg
     * @return {*}
     */
    findLevenshtein(collection, comparisonTexts, arg) {
        let alternative, shortest;
        alternative = shortest = null;
        const text = arg.replace(/^=/, "").toLowerCase();

        for (let [id, element] of collection) {
            let comps = typeof comparisonTexts === 'function' ? comparisonTexts(element) : comparisonTexts;

            for (let j = 0; j < comps.length; j++) {
                const comparison = comps[j];

                // se o nome for exato, retorna
                // se o nome parcial já for parte do nick, retorna
                if (text === comparison || (text.length >= 3 && comparison.indexOf(text) === 0)) {
                    alternative = element;
                    break;
                }

                const lev = levenshtein.get(text, comparison, { useCollator: true });
                // if (lev <= 3) {
                //     console.log('LEVEN', lev, text, comparison);
                //     console.log('LEVEN RATIO', (lev <= text.length / 3));
                // }
                if (lev <= text.length / 3 && (null === alternative || lev < shortest)) {
                    alternative = element;
                    shortest = lev;
                }
            }
        }

        if (alternative) {
            return alternative;
        }
        return null;
    }

    /**
     *
     * @param allArgsAreUsers
     * @return {Promise<*[]>}
     */
    async resolveUsers(allArgsAreUsers) {
        let mentioned = [];

        const mentions = this.message.mentions;
        if (mentions.users.size > 0) {
            const users = mentions.users.array();

            mentioned = mentioned.concat(users);

            if (this.clearFromArgs) {
                // tira eles da lista de argumentos
                users.forEach(user => {
                    this.args.splice(this.args.indexOf("<@!" + user.id + ">"), 1);
                });
            }
        }

        if (this.args.length > 0) {
            let foundUsers = [], foundUsersTexts = [];

            for (let i = 0; i < this.args.length; i++) {
                const arg = this.args[i];

                if (arg.match(/^=?[0-9]+$/) && arg.length >= 10) {
                    // se encontrar um id numerico
                    const text = arg.replace(/^=/, "");
                    try {
                        const user = await this.message.client.fetchUser(text);

                        if (user) {
                            foundUsers.push(user);
                            foundUsersTexts.push(arg);
                        }
                    } catch (err) {
                        // usuario não existe, ignorar
                    }

                } else if (this.message.guild && (allArgsAreUsers || arg.charAt(0) === '=')) {
                    let found = this.findLevenshtein(
                        this.message.guild.members,
                        member => {
                            let usernames = [];
                            usernames.push(member.user.username.toLowerCase());
                            if (member.nickname) {
                                usernames.push(member.nickname.toLowerCase());
                            }
                            return usernames;
                        },
                        arg
                    );

                    if (found) {
                        foundUsers.push(found.user);
                        foundUsersTexts.push(arg);
                    }
                }
            }

            if (this.clearFromArgs && foundUsersTexts.length) {
                // tira eles da lista de argumentos
                foundUsersTexts.forEach(text => {
                    this.args.splice(this.args.indexOf(text), 1);
                });
            }

            mentioned = mentioned.concat(foundUsers);
        }

        // tira repetidos (não pode usar o utils.arrayUnique pois é referencia
        // circular entre os dois modules)
        return mentioned.filter((item, pos) => mentioned.indexOf(item) === pos);
    }

    /**
     *
     * @param allArgsAreChannels
     * @return {Promise<*[]>}
     */
    async resolveChannels(allArgsAreChannels) {
        let mentioned = [];

        const mentions = this.message.mentions;
        if (mentions.channels.size > 0) {
            const channels = mentions.channels.array();

            mentioned = mentioned.concat(channels);

            if (this.clearFromArgs) {
                // tira eles da lista de argumentos
                channels.forEach(channel => {
                    this.args.splice(this.args.indexOf("<#" + channel.id + ">"), 1);
                });
            }
        }

        if (this.message.guild && this.args.length > 0) {
            let foundChannels = [], foundChannelsTexts = [];

            for (let i = 0; i < this.args.length; i++) {
                const arg = this.args[i];

                if (arg.match(/^=?[0-9]+$/) && arg.length >= 10) {
                    // se encontrar um id numerico
                    const text = arg.replace(/^=/, "");
                    const channel = this.message.guild.channels.get(text);

                    if (channel) {
                        foundChannels.push(channel);
                        foundChannelsTexts.push(arg);
                    }

                } else if (allArgsAreChannels || arg.charAt(0) === '=') {
                    let found = this.findLevenshtein(
                        this.message.guild.channels,
                        channel => [channel.name],
                        arg
                    );

                    if (found) {
                        foundChannels.push(found);
                        foundChannelsTexts.push(arg);
                    }
                }
            }

            if (this.clearFromArgs && foundChannelsTexts.length) {
                // tira eles da lista de argumentos
                foundChannelsTexts.forEach(text => {
                    this.args.splice(this.args.indexOf(text), 1);
                });
            }

            mentioned = mentioned.concat(foundChannels);
        }

        // tira repetidos (não pode usar o utils.arrayUnique pois é referencia
        // circular entre os dois modules)
        return mentioned.filter((item, pos) => mentioned.indexOf(item) === pos);
    }

    /**
     *
     * @param allArgsAreRoles
     * @return {Promise<*[]>}
     */
    async resolveRoles(allArgsAreRoles) {
        let mentioned = [];

        const mentions = this.message.mentions;
        if (mentions.roles.size > 0) {
            const roles = mentions.roles.array();

            mentioned = mentioned.concat(roles);

            if (this.clearFromArgs) {
                // tira eles da lista de argumentos
                roles.forEach(role => {
                    this.args.splice(this.args.indexOf("<@&" + role.id + ">"), 1);
                });
            }
        }

        if (this.message.guild && this.args.length > 0) {
            let foundRoles = [], foundRolesTexts = [];

            for (let i = 0; i < this.args.length; i++) {
                const arg = this.args[i];

                if (arg.match(/^=?[0-9]+$/) && arg.length >= 10) {
                    // se encontrar um id numerico
                    const text = arg.replace(/^=/, "");
                    const role = this.message.guild.roles.get(text);

                    if (role) {
                        foundRoles.push(role);
                        foundRolesTexts.push(arg);
                    }

                } else if (allArgsAreRoles || arg.charAt(0) === '=') {
                    let found = this.findLevenshtein(
                        this.message.guild.roles,
                        role => [role.name],
                        arg
                    );

                    if (found) {
                        foundRoles.push(found);
                        foundRolesTexts.push(arg);
                    }
                }
            }

            if (this.clearFromArgs && foundRolesTexts.length) {
                // tira eles da lista de argumentos
                foundRolesTexts.forEach(text => {
                    this.args.splice(this.args.indexOf(text), 1);
                });
            }

            mentioned = mentioned.concat(foundRoles);
        }

        // tira repetidos (não pode usar o utils.arrayUnique pois é referencia
        // circular entre os dois modules)
        return mentioned.filter((item, pos) => mentioned.indexOf(item) === pos);
    }

    /**
     *
     * @param allArgsAreElement
     * @return {Promise<*[]>}
     */
    async resolveAll(allArgsAreElement) {
        return []
            .concat(await this.resolveUsers(allArgsAreElement))
            .concat(await this.resolveRoles(allArgsAreElement))
            .concat(await this.resolveChannels(allArgsAreElement))
        ;
    }
}

module.exports = MessageIdResolvable;