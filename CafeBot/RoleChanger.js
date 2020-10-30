
const utils = require('../utils');
const Discord = require("discord.js");

const PermissionError = require('./Errors/PermissionError');

let bannedSuggestions = [];

// roles que não podem ser adicionadas por esse comando
const specialRoles = [];

const ROLE_PREFIX = 'joga-';
const SUGGEST_VOTES_MAX = 5;

class RoleChanger {
    constructor () {}

    get modName() { return 'rolechanger' }

    /**
     *
     * @param {import('discord.js').Guild} guild
     * @param {import('discord.js').Message} message
     * @param {String[]} args
     * @returns {Promise<any>}
     */
    async roleCommand(guild, message, args) {
        const arg = args.shift();

        // pega os membros que vão ter suas roles alteradas
        // let members = utils.resolveAllMentioned(message, args, false, true);
        // if (members.length > 0) {
        //     if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_ROLES)) {
        //         throw new PermissionError(`Você não tem permissão de alterar as roles de outra pessoa.`);
        //     }
        // } else {
        //     members.push(message.member);
        // }
        let members = [message.member];

        // filtra os args e só deixa sem repetição (o filter ta fazendo isso)
        args = args.map(role => role.replace(new RegExp(`^${ROLE_PREFIX}`, 'i'), '')).filter((v, i, a) => a.indexOf(v) === i);

        switch (arg) {
            case 'add':
            case 'a':
                return this.roleAddCommand(guild, message, args, members);
            case 'remove':
            case 'r':
                return this.roleRemoveCommand(guild, message, args, members);
            case 'list':
            case 'l':
                return this.roleListCommand(guild, message, args, members);
            case 'delete':
            case 'del':
            case 'd':
                return this.roleDeleteCommand(guild, message, args);
            case 'who':
            case 'w':
                return this.roleWhoCommand(guild, message, args);
            case 'suggest':
            case 's':
                return this.roleSuggestCommand(guild, message, args);
            default:
                return message.reply(`:x: Escolha o comando a ser usado: \`add, remove, who, suggest, delete\``);
        }
    }

    /**
     *
     * @param {import('discord.js').Guild} guild
     * @param {import('discord.js').Message} message
     * @param {String[]} args
     * @param {import('discord.js').GuildMember[]} members
     * @returns {Promise<any>}
     */
    async roleAddCommand(guild, message, args, members) {
        if (args.length === 0) {
            return message.reply(`Modo de usar: ${utils.printCommand('role', '(add | a)', '[lista das roles]')}
Adiciona uma ou mais roles pro seu usuário, ou para outro usuário (caso você tenha permissões).

  **Exemplo:**
${utils.printCommand('role', 'add', 'overwatch')}
${utils.printCommand('role', 'a', 'overwatch')}`);
        }

        const allRoles = await getAllRoles(guild);
        let rolesToAdd = [], rolesNotExist = [];

        args.forEach((roleName) => {
            const role = allRoles.find(role => role.name === `${ROLE_PREFIX}${roleName}`);

            if (specialRoles.includes(role)) {
                // FIXME: avisar o usuário que ele nao pode usar essa role?
                // FIXME: ou continuar assim pra ele nao perceber?
            } else {
                if (role) {
                    rolesToAdd.push(role);
                } else {
                    rolesNotExist.push(roleName);
                }
            }

        });

        if (rolesToAdd.length) {
            let promises = [];
            members.forEach(member => {
                let alreadyExistsRoles = [];
                rolesToAdd.forEach(r => {
                    if (member.roles.cache.has(r.id)) {
                        alreadyExistsRoles.push(r);
                    }
                });
                promises.push(member.roles.add(rolesToAdd.filter(r => !alreadyExistsRoles.includes(r)), 'Usou o comando +role'), alreadyExistsRoles);
            });
            return Promise.all(promises)
                .then((resolveValues) => {
                    let replyMsg = '', i;
                    for (i = 0; i < resolveValues.length; i+=2) {
                        const member = resolveValues[i];
                        const alreadyExistsRoles = resolveValues[i+1];

                        const addedList = rolesList(rolesToAdd.filter(r => !alreadyExistsRoles.includes(r)));
                        const existsList = rolesList(alreadyExistsRoles);

                        replyMsg += `${member}, `;
                        if (addedList) {
                            replyMsg += `:white_check_mark: Roles ${addedList} adicionadas. `;
                        }
                        if (existsList) {
                            replyMsg += `:x: Você já possui as roles ${existsList}. `;
                        }
                        replyMsg += "\n";
                    }
                    if (rolesNotExist.length) {
                        replyMsg += `:x: Roles não existentes: ${rolesList(rolesNotExist)}\n`;
                        replyMsg += `Digite ${utils.printCommand('role', 'list')} para ver todas disponíveis.`;
                    }

                    return message.channel.send(replyMsg);
                })
            ;
        } else {
            let replyTo = '';
            members.forEach(member => {
                replyTo += `${member}, `;
            });

            let replyMsg = `:x: Nenhuma role foi adicionada.`;
            if (rolesNotExist.length) {
                replyMsg += `:x: Roles não existentes: ${rolesList(rolesNotExist)}\n`;
                replyMsg += `Digite ${utils.printCommand('role', 'list')} para ver todas disponíveis.`;
            }

            return message.channel.send(replyTo + replyMsg);
        }
    }

    /**
     *
     * @param {import('discord.js').Guild} guild
     * @param {import('discord.js').Message} message
     * @param {String[]} args
     * @param {import('discord.js').GuildMember[]} members
     * @returns {Promise<Message|Message[]>|*}
     */
    async roleRemoveCommand(guild, message, args, members) {
        if (args.length === 0) {
            return message.reply(`Modo de usar: ${utils.printCommand('role', '(remove | r)', '[lista das roles]')}
Retira uma ou mais roles do seu usuário, ou de outro usuário (caso você tenha permissões).

  **Exemplo:**
${utils.printCommand('role', 'remove', 'csgo')}
${utils.printCommand('role', 'r', 'csgo')}`);
        }

        const allRoles = await getAllRoles(guild);
        let rolesToRemove = [], rolesNotExist = [];

        args.forEach((roleName) => {
            const role = allRoles.find(role => role.name === `${ROLE_PREFIX}${roleName}`);

            if (specialRoles.includes(role)) {
                // FIXME: avisar o usuário que ele nao pode usar essa role?
                // FIXME: ou continuar assim pra ele nao perceber?
            } else {
                if (role) {
                    rolesToRemove.push(role);
                } else {
                    rolesNotExist.push(roleName);
                }
            }

        });

        if (rolesToRemove.length) {
            let promises = [];
            members.forEach(member => {
                let nonExistsRoles = [];
                rolesToRemove.forEach(r => {
                    if (!member.roles.cache.has(r.id)) {
                        nonExistsRoles.push(r);
                    }
                });
                promises.push(member.roles.remove(rolesToRemove, 'Usou o comando +role'), nonExistsRoles);
            });
            return Promise.all(promises)
                .then((resolveValues) => {
                    let replyMsg = '', i;
                    for (i = 0; i < resolveValues.length; i+=2) {
                        const member = resolveValues[i];
                        const nonExistsRoles = resolveValues[i+1];

                        const removedList = rolesList(rolesToRemove.filter(r => !nonExistsRoles.includes(r)));
                        const existsList = rolesList(nonExistsRoles);

                        replyMsg += `${member}, `;
                        if (removedList) {
                            replyMsg += `:white_check_mark: Roles ${removedList} removidas. `;
                        }
                        if (existsList) {
                            replyMsg += `:x: Você não possuia as roles ${existsList}. `;
                        }
                        replyMsg += "\n";
                    }
                    if (rolesNotExist.length) {
                        replyMsg += `:x: Roles não existentes: ${rolesList(rolesNotExist)}\n`;
                        replyMsg += `Digite ${utils.printCommand('role', 'list')} para ver todas disponíveis.`;
                    }

                    return message.channel.send(replyMsg);
                })
            ;
        } else {
            let replyTo = '';
            members.forEach(member => {
                replyTo += `${member}, `;
            });

            let replyMsg = `:x: Nenhuma role foi removida.`;
            if (rolesNotExist.length) {
                replyMsg += `:x: Roles não existentes: ${rolesList(rolesNotExist)}\n`;
                replyMsg += `Digite ${utils.printCommand('role', 'list')} para ver todas disponíveis.`;
            }

            return message.channel.send(replyTo + replyMsg);
        }
    }

    /**
     *
     * @param {import('discord.js').Guild} guild
     * @param {import('discord.js').Message} message
     * @param {String[]} args
     * @param {import('discord.js').GuildMember[]} members
     */
    async roleListCommand(guild, message, args, members) {
        let text = '';
        members.forEach(member => {
            const memberRoles = rolesList(member.roles.cache.filter(role => role.name.indexOf(ROLE_PREFIX) === 0).array()) || "*(vazia)*";
            text += `${member}, **Sua lista de roles:**\n${memberRoles}\n`;
        });

        const allRoles = await getAllRoles(guild);
        console.log(allRoles);
        text += `**Roles disponiveis:**\n${rolesList(allRoles)}`;

        return utils.longMessage(message).send(text);
    }

    /**
     *
     * @param {import('discord.js').Guild} guild
     * @param {import('discord.js').Message} message
     * @param {String[]} args
     */
    async roleDeleteCommand(guild, message, args) {
        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_ROLES)) {
            throw new PermissionError(`Você não tem permissão de deletar uma role.`);
        }

        if (args.length === 0) {
            return message.reply(`Modo de usar: ${utils.printCommand('role', '(delete | d)', '(role)')}
Deleta uma role específica, caso você tenha permissões para isso.

  **Exemplo:**
${utils.printCommand('role', 'delete', 'cah')}
${utils.printCommand('role', 'd', 'cah')}`);
        }

        const allRoles = await getAllRoles(guild);
        const roleName = args[0];
        const role = allRoles.find(role => role.name === `${ROLE_PREFIX}${roleName}`);
        if (!role) {
            return message.reply(`:x: Role ${rolesList(roleName)} não existente.\nDigite ${utils.printCommand('role', 'list')} para ver todas disponíveis.`);
        }

        return role.delete('Usou o comando +role delete')
            .then(deletedRole => {
                return message.reply(`:white_check_mark: Role \`${deletedRole.name}\` excluída com sucesso.`);
            })
        ;
    }

    /**
     *
     * @param {import('discord.js').Guild} guild
     * @param {import('discord.js').Message} message
     * @param {String[]} args
     */
    async roleWhoCommand(guild, message, args) {
        if (args.length === 0) {
            return message.reply(`Modo de usar: ${utils.printCommand('role', '(who | w)', '(role)')}
Mostra quais pessoas estão marcadas com uma role específica.

  **Exemplo:**
${utils.printCommand('role', 'who', 'among-us')}
${utils.printCommand('role', 'w', 'among-us')}`);
        }

        const allRoles = await getAllRoles(guild);
        const roleName = args[0];
        const role = allRoles.find(role => role.name === `${ROLE_PREFIX}${roleName}`);
        if (!role) {
            return message.reply(`:x: Role ${rolesList(roleName)} não existente.\n**Roles disponiveis:**\n${rolesList(allRoles, false)}`);
        }

        await guild.members.fetch(); // prepara o cache
        const membersWithRole = role.members.array();

        const membersWithRoleList = membersWithRole.map(m => {
            if (!m.nickname) {
                return `${m.user.username}#${m.user.discriminator}`;
            }
            return m.nickname + ` (${m.user.username}#${m.user.discriminator})`;
        }).map(n => `:small_blue_diamond: ${n}`).join("\n");

        if (membersWithRoleList) {
            return message.reply(`Membros que estão com a role ${rolesList(roleName)}:\n${membersWithRoleList}`);
        } else {
            return message.reply(`:x: Ninguém possui esta role.`);
        }
    }

    /**
     *
     * @param {import('discord.js').Guild} guild
     * @param {import('discord.js').Message} message
     * @param {String[]} args
     * @returns {Promise<any>}
     */
    async roleSuggestCommand(guild, message, args) {
        if (args.length === 0) {
            return message.reply(`Modo de usar: ${utils.printCommand('role', '(suggest | s)', '(role)')}
Sugere uma nova role para ser votada. Se ela receber ${SUGGEST_VOTES_MAX} votos "sim", ela é criada.

  **Exemplo:**
${utils.printCommand('role', 'suggest', 'pinball')}
${utils.printCommand('role', 's', 'pinball')}
:rotating_light: **Use o bom senso ao sugerir.** Trollagens e nomes ofensivos serão passiveis de advertência :rotating_light:`);
        }

        const allRoles = await getAllRoles(guild);

        // TODO: colocar esse .filter no utils como .unique
        let argRole = ROLE_PREFIX + args.join('-').toLowerCase().replace(new RegExp(ROLE_PREFIX, 'i'), '');
        const suggestedRoles = [argRole].filter(roleName => !allRoles.find(r => r.name === roleName)).filter(roleName => /^[a-z][a-z0-9-]*$/.test(roleName));

        //console.log('banned', bannedSuggestions);

        for (let i = 0; i < suggestedRoles.length; i++) {
            if (bannedSuggestions.includes(suggestedRoles[i])) {
                return message.reply(`:x: Não é possível sugerir ${rolesList(suggestedRoles[i])}, esta role foi banida.`);
            }
        }

        if (suggestedRoles.length) {
            const emb = new Discord.MessageEmbed()
                .setAuthor(message.member.user.username)
                .setColor(3447003)
                .setDescription(`Sugeriu a(s) role(s) \`\`\`${suggestedRoles.join(', ')}\`\`\`
Reaja com ✅ nesse comentário para que essa role exista.
Reaja com ❌ nesse comentário para banir essa sugestão.
Mínimo de **${SUGGEST_VOTES_MAX} votos**.
*O voto do bot não conta*`);

            return message.channel.send({embed: emb})
                .then(msg => {
                    const p = [
                        msg.react('✅'),
                        msg.react('❌')
                    ];
                    return Promise.all(p);
                });

        } else {
            return message.reply(`:x: Todas as roles sugeridas já existem ou são incompatíveis com o Discord. Lembre-se que só podem ser usados *letras, números e hífen*.`);
        }
    }

    /**
     * Invocado toda vez que alguém dá um reaction em alguma mensagem.
     *
     * @param {import('discord.js').Guild} guild
     * @param {import('discord.js').MessageReaction} messageReaction O objeto reaction, que contem a mensagem e o emoji dado
     * @param {import('discord.js').User} user O usuário que fez essa reaction (pode ser membro do server ou não)
     */
    async onReactionAdd(guild, messageReaction, user) {

        // se a mensagem nao tiver embed, ignorar
        if (!messageReaction.message.embeds.length) return;
        if (user.bot) return;

        // ignorar qualquer outro emoji e só considerar quando for o check
        if (!['✅', '❌'].includes(messageReaction.emoji.name)) return;

        const emb = messageReaction.message.embeds[0];
        // pega qual foram as roles sugeridas
        const roles = extractRoles(emb.description);
        const action = messageReaction.emoji.name === '✅' ? 'approve' : 'ban';
        const channel = messageReaction.message.channel;

        if (roles) {
            if (messageReaction.count >= SUGGEST_VOTES_MAX + 1) {
                // deleta a mensagem da votacao pra nao dar conflito depois.
                messageReaction.message.delete();

                if (action === 'approve') {
                    const allRoles = await getAllRoles(guild);

                    let createdRoles = [], p = [];
                    roles.forEach(roleName => {
                        if (!allRoles.find(r => r.name === roleName)) {
                            createdRoles.push(roleName);
                            p.push(guild.roles.create({
                                data: {name: roleName, mentionable: true},
                                reason: `Por sugestão de ${emb.author.name} com +role suggest`
                            }));
                        }
                    });

                    return Promise.all(p)
                        .then(created => {
                            // FIXME: precisa avisar que não foi adicionada pq ja existia?
                            createdRoles = createdRoles.join(', ');
                            return channel.send(`:white_check_mark: Role(s) ${rolesList(createdRoles)} criada(s) por sugestão.`)
                        })
                    ;

                } else if (action === 'ban') {
                    roles.forEach(roleName => {
                        bannedSuggestions.push(roleName);
                    });

                    const banned = roles.join(', ');
                    return channel.send(`:x: Role(s) ${rolesList(banned)} banidas(s). Não poderá(ão) ser mais sugerida(s).`)
                }

            }
        }
    }
    //
    // onRoleCreate(role) {
    //     if (!allRoles) return;
    //
    //     // a role tem que ter o prefixo joga-
    //     if (role.name.indexOf(ROLE_PREFIX) !== 0) {
    //         return;
    //     }
    //
    //     // a role não pode ser uma role especial
    //     if (specialRoles.includes(role.name)) {
    //         return;
    //     }
    //
    //     allRoles.set(role.id, role);
    // }
    //
    // onRoleDelete(role) {
    //     if (!allRoles) return;
    //
    //     if (allRoles.get(role.id)) {
    //         allRoles.delete(role.id);
    //     }
    // }
    //
    // onRoleUpdate(oldRole, newRole) {
    //     if (!allRoles) return;
    //
    //     if (allRoles.get(oldRole.id)) {
    //         allRoles.set(oldRole.id, newRole);
    //     }
    // }

    commands() {
        return {
            'role': [this.roleCommand, { guild: true, disallowDM: true }]
        }
    }

    events() {
        return {
            'messageReactionAdd': [this.onReactionAdd, { guild: true }],
            // 'roleCreate': this.onRoleCreate,
            // 'roleDelete': this.onRoleDelete,
            // 'roleUpdate': this.onRoleUpdate,
        }
    }
}

/**
 * @param {import('discord.js').Guild} guild
 * @return {import('discord.js').Role[]}
 */
async function getAllRoles(guild) {
    const allRoles = await guild.roles.fetch();
    return allRoles.cache
        .clone()
        .filter(role => role.name.indexOf(ROLE_PREFIX) === 0 && !specialRoles.includes(role.name))
        .array();
}

function extractRoles(content) {
    const joinedRoles = content.match(/```(.*?)```/)[1];
    if (!joinedRoles) {
        return [];
    }
    return joinedRoles.split(/, /g);
}

/**
 *
 * @param {import('discord.js').Role[]|import('discord.js').Role|string[]|string} roles
 * @param {Boolean} withCodeChar
 * @returns {string}
 */
function rolesList(roles, withCodeChar = true) {
    if (!Array.isArray(roles)) {
        roles = [roles];
    }

    if (!roles.length) {
        return '';
    }

    return (withCodeChar ? '`' : "```\n") + roles
        .map(role => {
            let name;
            if (typeof role === 'string') {
                name = role;
            } else {
                name = role.name;
            }
            return name.replace(new RegExp(`^${ROLE_PREFIX}`, 'i'), '');
        })
        .sort()
        .join(withCodeChar ? '`, `' : ', ') + (withCodeChar ? '`' : "\n```");
}

module.exports = RoleChanger;
