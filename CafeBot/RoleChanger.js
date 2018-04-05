
const utils = require('../utils');
const Discord = require("discord.js");

let bannedSuggestions = [];
let allRoles;

// roles que não podem ser adicionadas por esse comando
const specialRoles = [];

const ROLE_PREFIX = 'joga-';
const SUGGEST_VOTES_MAX = 5;

class RoleChanger {
    constructor () {}

    static get name() { return 'rolechanger' }

    static roleCommand(message, args) {
        const arg = args.shift();

        if (!message.guild.available) {
            message.reply(`:x: Por algum motivo, o discord está com problemas para fazer leituras.`);
            return;
        }

        // pega todas as roles disponiveis
        if (!allRoles) {
            allRoles = message.guild.roles.clone().filter(role => role.name.indexOf(ROLE_PREFIX) === 0 && !specialRoles.includes(role.name));
        }

        // pega os membros que vão ter suas roles alteradas
        let members = [];
        if (message.mentions.members.size > 0) {
            if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_ROLES)) {
                message.reply(`:x: *Você não tem permissão de alterar as roles de outra pessoa.*`);
                return;
            }

            members = message.mentions.members.array();

            // tira eles da lista de argumentos
            members.forEach(member => {
                args.splice(args.indexOf('<@!'+member.id+'>'), 1);
            });
        } else {
            members.push(message.member);
        }

        // filtra os args e só deixa sem repetição (o filter ta fazendo isso)
        args = args.map(role => role.replace(new RegExp('^' + ROLE_PREFIX, 'i'), '')).filter((v, i, a) => a.indexOf(v) === i);

        switch (arg) {
            case 'add':
            case 'a':
                return RoleChanger.roleAddCommand(message, args, members, allRoles);
            case 'remove':
            case 'r':
                return RoleChanger.roleRemoveCommand(message, args, members, allRoles);
            case 'list':
            case 'l':
                return RoleChanger.roleListCommand(message, args, members, allRoles);
            case 'delete':
            case 'del':
            case 'd':
                return RoleChanger.roleDeleteCommand(message, args, allRoles);
            case 'who':
            case 'w':
                return RoleChanger.roleWhoCommand(message, args, allRoles);
            case 'suggest':
            case 's':
                return RoleChanger.roleSuggestCommand(message, args, allRoles);
            default:
                message.reply(`:x: Escolha o comando a ser usado: \`add, remove, who, suggest, delete\``);
        }
    }

    /**
     *
     * @param message
     * @param args
     * @param members
     * @param allRoles
     */
    static roleAddCommand(message, args, members, allRoles) {
        if (args.length === 0) {
            message.channel.send(`Modo de usar: \`+role (add | a) [lista das roles]\`
Adiciona uma ou mais roles pro seu usuário, ou para outro usuário (caso você tenha permissões).

  **Exemplo:**
\`\`\`+role add overwatch
+role a overwatch\`\`\``);
            return;
        }

        let rolesToAdd = [], rolesNotExist = [];

        args.forEach((roleName) => {
            const role = allRoles.find('name', ROLE_PREFIX + roleName);

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
                    if (member.roles.has(r.id)) {
                        alreadyExistsRoles.push(r);
                    }
                });
                promises.push(member.addRoles(rolesToAdd.filter(r => !alreadyExistsRoles.includes(r)), 'Usou o comando +role'), alreadyExistsRoles);
            });
            Promise.all(promises)
                .then((resolveValues) => {
                    let replyMsg = '', i;
                    for (i = 0; i < resolveValues.length; i+=2) {
                        const member = resolveValues[i];
                        const alreadyExistsRoles = resolveValues[i+1];

                        const addedList = rolesToAdd.filter(r => !alreadyExistsRoles.includes(r)).map(role => role.name.replace(/^joga-/, '')).join('`, `');
                        const existsList = alreadyExistsRoles.map(role => role.name.replace(/^joga-/, '')).join('`, `');

                        replyMsg += `${member}, `;
                        if (addedList) {
                            replyMsg += `:white_check_mark: Roles \`${addedList}\` adicionadas. `;
                        }
                        if (existsList) {
                            replyMsg += `:x: Você já possui as roles \`${existsList}\`. `;
                        }
                        replyMsg += "\n";
                    }
                    if (rolesNotExist.length) {
                        replyMsg += ` :x: Roles não existentes: \`${rolesNotExist.join('`, `')}\`\n **Roles disponiveis:**\n\`\`\`\n${rolesList(allRoles)}\n\`\`\``;
                    }

                    message.channel.send(replyMsg);
                })
                .catch(console.error);
        } else {
            let replyTo = '';
            members.forEach(member => {
                replyTo += `${member}, `;
            });

            let replyMsg = `:x: Nenhuma role foi adicionada.`;
            if (rolesNotExist.length) {
                replyMsg += ` :x: Roles não existentes: \`${rolesNotExist.join('`, `')}\`\n **Roles disponiveis:**\n\`\`\`\n${rolesList(allRoles)}\n\`\`\``;
            }

            message.channel.send(replyTo + replyMsg);
        }
    }

    /**
     *
     * @param message
     * @param args
     * @param members
     * @param allRoles
     */
    static roleRemoveCommand(message, args, members, allRoles) {
        if (args.length === 0) {
            message.channel.send(`Modo de usar: \`+role (remove | r) [lista das roles]\`
Retira uma ou mais roles do seu usuário, ou de outro usuário (caso você tenha permissões).

  **Exemplo:**
\`\`\`+role remove csgo
+role r csgo\`\`\``);
            return;
        }

        let rolesToRemove = [], rolesNotExist = [];

        args.forEach((roleName) => {
            const role = allRoles.find('name', ROLE_PREFIX + roleName);

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
                    if (!member.roles.has(r.id)) {
                        nonExistsRoles.push(r);
                    }
                });
                promises.push(member.removeRoles(rolesToRemove, 'Usou o comando +role'), nonExistsRoles);
            });
            Promise.all(promises)
                .then((resolveValues) => {
                    let replyMsg = '', i;
                    for (i = 0; i < resolveValues.length; i+=2) {
                        const member = resolveValues[i];
                        const nonExistsRoles = resolveValues[i+1];

                        const removedList = rolesToRemove.filter(r => !nonExistsRoles.includes(r)).map(role => role.name.replace(/^joga-/, '')).join('`, `');
                        const existsList = nonExistsRoles.map(role => role.name.replace(/^joga-/, '')).join('`, `');

                        replyMsg += `${member}, `;
                        if (removedList) {
                            replyMsg += `:white_check_mark: Roles \`${removedList}\` removidas. `;
                        }
                        if (existsList) {
                            replyMsg += `:x: Você não possuia as roles \`${existsList}\`. `;
                        }
                        replyMsg += "\n";
                    }
                    if (rolesNotExist.length) {
                        replyMsg += ` :x: Roles não existentes: \`${rolesNotExist.join('`, `')}\`\n **Roles disponiveis:**\n\`\`\`\n${rolesList(allRoles)}\n\`\`\``;
                    }

                    message.channel.send(replyMsg);
                })
                .catch(console.error);
        } else {
            let replyTo = '';
            members.forEach(member => {
                replyTo += `${member}, `;
            });

            let replyMsg = `:x: Nenhuma role foi removida.`;
            if (rolesNotExist.length) {
                replyMsg += ` :x: Roles não existentes: \`${rolesNotExist.join('`, `')}\`\n **Roles disponiveis:**\n\`\`\`\n${rolesList(allRoles)}\n\`\`\``;
            }

            message.channel.send(replyTo + replyMsg);
        }
    }

    /**
     *
     * @param message
     * @param args
     * @param members
     * @param allRoles
     */
    static roleListCommand(message, args, members, allRoles) {
        let text = '';
        members.forEach(member => {
            const memberRoles = member.roles.array().filter(role => role.name.indexOf('joga-') === 0).map(role => role.name.replace(/^joga-/, '')).sort().join(', ');
            text += `${member}, **Sua lista de roles:**\n\`\`\`\n${memberRoles}\n\`\`\`\n`;
        });

        text += `  **Roles disponiveis:**\n\`\`\`\n${rolesList(allRoles)}\n\`\`\``;

        message.channel.send(text);
    }

    /**
     *
     * @param message
     * @param args
     * @param allRoles
     */
    static roleDeleteCommand(message, args, allRoles) {
        if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_ROLES)) {
            message.reply(`:x: *Você não tem permissão de deletar uma role.*`);
            return;
        }

        const roleName = args[0];
        const role = allRoles.find('name', 'joga-' + roleName);
        if (!role) {
            message.reply(`:x: Role \`${roleName}\` não existente.
  **Roles disponiveis:**
\`\`\`
${rolesList(allRoles)}
\`\`\``);
            return;
        }

        role.delete('Usou o comando +role delete')
            .then(deletedRole => {
                message.reply(`:white_check_mark: Role \`${deletedRole.name}\` excluída com sucesso.`);
            })
            .catch(console.error);
    }

    /**
     *
     * @param message
     * @param args
     * @param allRoles
     */
    static roleWhoCommand(message, args, allRoles) {
        if (args.length === 0) {
            message.channel.send(`Modo de usar: \`+role (who | w) (role)\`
Indica quais pessoas estão marcadas com uma role específica.

  **Exemplo:**
\`\`\`+role who cah
+role w cah\`\`\``);
            return;
        }

        const roleName = args[0];
        const role = allRoles.find('name', 'joga-' + roleName);
        if (!role) {
            message.reply(`:x: Role \`${roleName}\` não existente.
  **Roles disponiveis:**
\`\`\`
${rolesList(allRoles)}
\`\`\``);
            return;
        }

        let membersWithRole = [];
        message.guild.members.array().forEach(mb => {
            if (mb.roles.some(r => ['joga-' + roleName].includes(r.name))) {
                membersWithRole.push(mb);
            }
        });

        const membersWithRoleList = membersWithRole.map(m => {
            if (!m.nickname) {
                return `${m.user.username}#${m.user.discriminator}`;
            }
            return m.nickname + ` (${m.user.username}#${m.user.discriminator})`;
        }).map(n => `:small_blue_diamond: ${n}`).join("\n");

        if (membersWithRoleList) {
            message.reply(`
Membros que estão com a role \`${roleName}\`:
${membersWithRoleList}
`);
        } else {
            message.reply(`:x: Ninguém possui esta role.`);
        }
    }

    /**
     *
     * @param message
     * @param args
     * @param allRoles
     */
    static roleSuggestCommand(message, args, allRoles) {
        if (args.length === 0) {
            message.channel.send(`Modo de usar: \`+role (suggest | s) [lista das roles]\`
Sugere uma nova role para ser votada. Se ela receber ${SUGGEST_VOTES_MAX} votos "sim", ela é criada.

  **Exemplo:**
\`\`\`+role suggest pinball
+role s pinball\`\`\`
:rotating_light: **Use o bom senso ao sugerir.** Trollagens e nomes ofensivos serão passiveis de advertência :rotating_light:`);
            return;
        }

        // TODO: colocar esse .filter no utils como .unique
        const suggestedRoles = args.map(role => 'joga-' + role.toLowerCase()).filter(rolename => !allRoles.exists('name', rolename)).filter(rolename => /^[a-z][a-z0-9-]*$/.test(rolename));

        //console.log('banned', bannedSuggestions);

        for (let i = 0; i < suggestedRoles.length; i++) {
            if (bannedSuggestions.includes(suggestedRoles[i])) {
                message.reply(`:x: Não é possível sugerir \`${suggestedRoles[i]}\`, esta role foi banida.`);
                return;
            }
        }

        if (suggestedRoles.length) {
            const emb = new Discord.RichEmbed()
                .setAuthor(message.member.user.username)
                .setColor(3447003)
                .setDescription(`Sugeriu a(s) role(s) \`\`\`${suggestedRoles.join(', ')}\`\`\`
Reaja com ✅ nesse comentário para que essa role exista.
Reaja com ❌ nesse comentário para banir essa sugestão.
Mínimo de **${SUGGEST_VOTES_MAX} votos**.
*O voto do bot não conta*`);

            message.channel.send({embed: emb})
                .then(msg => {
                    msg.react('✅');
                    msg.react('❌');
                }).catch(console.error);

        } else {
            message.reply(`:x: Todas as roles sugeridas já existem ou são incompatíveis com o Discord. Lembre-se que só podem ser usados *letras, números e hífen*.`);
        }
    }

    /**
     * Invocado toda vez que alguém dá um reaction em alguma mensagem.
     *
     * @param {Discord.MessageReaction} messageReaction O objeto reaction, que contem a mensagem e o emoji dado
     * @param {Discord.User} user O usuário que fez essa reaction (pode ser membro do server ou não)
     */
    static onReactionAdd(messageReaction, user) {

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
        const guild = messageReaction.message.guild;

        if (roles) {
            if (messageReaction.count >= SUGGEST_VOTES_MAX + 1) {
                // deleta a mensagem da votacao pra nao dar conflito depois.
                messageReaction.message.delete();

                if (action === 'approve') {
                    let createdRoles = [];
                    roles.forEach(roleName => {
                        if (!guild.roles.exists('name', roleName)) {
                            createdRoles.push(roleName);
                            guild.createRole({name: roleName, mentionable: true}, `Por sugestão de ${emb.author.name} com +role suggest`);
                        }
                    });

                    if (createdRoles) {
                        createdRoles = createdRoles.join(', ');
                        channel.send(`:white_check_mark: Role(s) \`${createdRoles}\` criada(s) por sugestão.`)
                    } else {
                        // FIXME: precisa avisar que não foi adicionada pq ja existia?
                    }

                } else if (action === 'ban') {
                    roles.forEach(roleName => {
                        bannedSuggestions.push(roleName);
                    });

                    const banned = roles.join(', ');
                    channel.send(`:x: Role(s) \`${banned}\` banidas(s). Não poderá(ão) ser mais sugerida(s).`)
                }

            }
        }
    }

    static onRoleCreate(role) {
        if (!allRoles) return;

        // a role tem que ter o prefixo joga-
        if (role.name.indexOf(ROLE_PREFIX) !== 0) {
            return;
        }

        // a role não pode ser uma role especial
        if (specialRoles.includes(role.name)) {
            return;
        }

        allRoles.set(role.id, role);
    }

    static onRoleDelete(role) {
        if (!allRoles) return;

        if (allRoles.get(role.id)) {
            allRoles.delete(role.id);
        }
    }

    static onRoleUpdate(oldRole, newRole) {
        if (!allRoles) return;

        if (allRoles.get(oldRole.id)) {
            allRoles.set(oldRole.id, newRole);
        }
    }

    static commands() {
        return {
            'role': RoleChanger.roleCommand
        }
    }

    static events() {
        return {
            'messageReactionAdd': RoleChanger.onReactionAdd,
            'roleCreate': RoleChanger.onRoleCreate,
            'roleDelete': RoleChanger.onRoleDelete,
            'roleUpdate': RoleChanger.onRoleUpdate,
        }
    }
}

function extractRoles(content) {
    const joinedRoles = content.match(/```(.*?)```/)[1];
    if (!joinedRoles) {
        return [];
    }
    return joinedRoles.split(/, /g);
}

function rolesList(roles) {
    return roles.array().map(role => role.name.replace(/^joga-/, '')).sort().join(', ');
}

module.exports = RoleChanger;