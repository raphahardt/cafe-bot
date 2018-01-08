
const utils = require('../utils');
const Discord = require("discord.js");

let bannedSuggestions = [];

class RoleChanger {
    constructor () {}

    static get name() { return 'rolechanger' }

    static roleCommand(message, args) {
        const intent = args.shift();
        const roles = message.guild.roles.filter(role => role.name.indexOf('joga-') === 0);
        let member;

        // se foi pra adicionar pra outra pessoa, ou se foi pra vc mesmo
        if (message.mentions.members && message.mentions.members.array().length) {
            if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_ROLES)) {
                message.reply(`:x: *Você não tem permissão de alterar as roles de outra pessoa.*`);
                return;
            }let replyMsg = `:x: Você já possui estas roles.`;
            member = message.mentions.members.first();
            // tira ele da lista de argumentos
            args.splice(args.indexOf('<@!'+member.id+'>'), 1);
        } else {
            member = message.member;
        }

        if (!member) return;

        // filtra os args e só deixa sem repetição
        args = args.filter((v, i, a) => a.indexOf(v) === i);

        if (intent === 'add' || intent === 'a') {

            if (args.length === 0) {
                message.channel.send(`Modo de usar: \`+role (add | a) [lista das roles]\`
  **Exemplo:**
\`\`\`+role add overwatch
+role a overwatch\`\`\``);
                return;
            }

            let rolesToAdd = [], rolesNotExist = [];

            args.forEach((roleName) => {
                const role = roles.find('name', 'joga-' + roleName);

                if (role) {
                    if (!member.roles.has(role.id)) {
                        rolesToAdd.push(role);
                    }
                } else {
                    rolesNotExist.push(roleName);
                }
            });

            if (rolesToAdd.length) {
                member.addRoles(rolesToAdd, 'Usou o comando +role')
                    .then((memb) => {
                        const roleList = rolesToAdd.map(role => role.name.replace(/^joga-/, '')).join(', ');
                        let replyMsg = `:white_check_mark: Roles \`${roleList}\` adicionadas.`;
                        if (rolesNotExist.length) {
                            replyMsg += ` :x: Roles não existentes: \`${rolesNotExist}\``;
                        }

                        message.reply(replyMsg);
                    })
                    .catch(console.error);
            } else {
                let replyMsg = `:x: Você já possui estas roles.`;
                if (rolesNotExist.length) {
                    replyMsg += ` Roles não existentes: \`${rolesNotExist}\``;
                }

                message.reply(replyMsg);
            }

        } else if (intent === 'remove' || intent === 'del' || intent === 'r') {

            if (args.length === 0) {
                message.channel.send(`Modo de usar: \`+role (remove | r) [lista das roles]\`
  **Exemplo:**
\`\`\`+role remove csgo
+role r csgo\`\`\``);
                return;
            }

            let rolesToRemove = [], rolesNotExist = [];

            args.forEach((roleName) => {
                const role = roles.find('name', 'joga-' + roleName);

                if (role) {
                    if (member.roles.has(role.id)) {
                        rolesToRemove.push(role);
                    }
                } else {
                    rolesNotExist.push(roleName);
                }
            });

            if (rolesToRemove.length) {
                member.removeRoles(rolesToRemove, 'Usou o comando +role')
                    .then((memb) => {
                        const roleList = rolesToRemove.map(role => role.name.replace(/^joga-/, '')).join(', ');
                        let replyMsg = `:white_check_mark: Roles \`${roleList}\` removidas.`;
                        if (rolesNotExist.length) {
                            replyMsg += ` :x: Roles não existentes: \`${rolesNotExist}\``;
                        }

                        message.reply(replyMsg);
                    })
                    .catch(console.error);
            } else {
                let replyMsg = `:x: Nenhuma role foi removida.`;
                if (rolesNotExist.length) {
                    replyMsg += ` Roles não existentes: \`${rolesNotExist}\``;
                }

                message.reply(replyMsg);
            }

        } else if (intent === 'list' || intent === 'l') {

            const myRoleList = member.roles.array().filter(role => role.name.indexOf('joga-') === 0).map(role => role.name.replace(/^joga-/, '')).sort().join(', ');
            const roleList = roles.array().map(role => role.name.replace(/^joga-/, '')).sort().join(', ');

            message.reply(`
  **Lista das suas roles:**
\`\`\`
${myRoleList}
\`\`\`
  **Roles disponiveis:**
\`\`\`
${roleList}
\`\`\`
            `);

        } else if (intent === 'suggest' || intent === 's') {

            if (args.length === 0) {
                message.channel.send(`Modo de usar: \`+role (suggest | s) [lista das roles]\`
  **Exemplo:**
\`\`\`+role suggest pinball
+role s pinball\`\`\`
:rotating_light: **Use o bom senso ao sugerir.** Trollagens e nomes ofensivos serão passiveis de advertência :rotating_light:`);
                return;
            }

            // TODO: colocar esse .filter no utils como .unique
            const suggestedRoles = args.map(role => 'joga-' + role.toLowerCase()).filter(rolename => !roles.exists('name', rolename)).filter(rolename => /^[a-z][a-z0-9-]*$/.test(rolename)).join(', ');

            for (let i = 0; i < suggestedRoles.length; i++) {
                if (bannedSuggestions.includes(suggestedRoles[i])) {
                    message.reply(`:x: Não é possível sugerir \`${suggestedRoles[i]}\`, esta role foi banida.`);
                    return;
                }
            }

            if (suggestedRoles) {
                const emb = new Discord.RichEmbed()
                    .setAuthor(message.member.user.username)
                    .setColor(3447003)
                    .setDescription(`Sugeriu a(s) role(s) \`\`\`${suggestedRoles}\`\`\`
Reaja com ✅ nesse comentário para que essa role exista.
Reaja com ❌ nesse comentário para banir essa sugestão.
Mínimo de **5 votos**.
*O voto do bot não conta*`);

                message.channel.send({embed: emb})
                    .then(msg => {
                        msg.react('✅');
                        msg.react('❌');
                    });

            } else {
                message.reply(`:x: Todas as roles sugeridas já existem ou são incompatíveis com o Discord. Lembre-se que só podem ser usados *letras, números e hífen*.`);
            }

        } else {
            const roleList = roles.array().map(role => role.name.replace(/^joga-/, '')).sort().join(', ');

            message.channel.send(`Modo de usar: \`+role (add | remove | list | suggest) [lista das roles]\`
Só vale para roles que começarem com \@joga-
  **Exemplos:**
\`\`\`
+role add dont-starve
+role remove overwatch
+role add brawlhalla cah csgo
+role list
+role suggest pinball
\`\`\`
  **Roles disponiveis:**
\`\`\`
${roleList}
\`\`\`
:rotating_light: **Use o bom senso ao sugerir uma role.** Trollagens e nomes ofensivos serão passiveis de advertência :rotating_light:
            `);
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

        if (roles) {
            if (messageReaction.count >= 6) {
                if (action === 'approve') {
                    let createdRoles = [];
                    roles.forEach(roleName => {
                        const guild = messageReaction.message.guild;
                        if (!guild.roles.exists('name', roleName)) {
                            createdRoles.push(roleName);
                            guild.createRole({name: roleName, mentionable: true}, `Por sugestão de ${emb.author.name} com +role suggest`);
                        }
                    });

                    if (createdRoles) {
                        createdRoles = createdRoles.join(', ');
                        messageReaction.message.channel.send(`:white_check_mark: Role(s) \\\`${createdRoles}\\\` criada(s) por sugestão.`)
                    } else {
                        // FIXME: precisa avisar que não foi adicionada pq ja existia?
                    }

                } else if (action === 'ban') {
                    roles.forEach(roleName => {
                        bannedSuggestions.push(roleName);
                    });

                    const banned = roles.join(', ');
                    messageReaction.message.channel.send(`:x: Role(s) \\\`${banned}\\\` banidas(s). Não poderá(ão) ser mais sugerida(s).`)
                }
            }
        }
    }

    static commands() {
        return {
            'role': RoleChanger.roleCommand
        }
    }

    static events() {
        return {
            'messageReactionAdd': RoleChanger.onReactionAdd
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

module.exports = RoleChanger;