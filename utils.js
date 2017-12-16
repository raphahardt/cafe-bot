
module.exports = {

    /**
     * O prefixo dos comandos do bot.
     *
     * @type {String}
     */
    prefix: '+',

    /**
     * Retorna true se o usuário for um bot.
     * Essa função é útil pra excluir bots de alguns eventos e comandos, senão
     * pode dar o possível 'botception'
     *
     * @param {Discord.GuildMember} member O membro a ser verificado se é bot
     * @returns {boolean}
     */
    verifyUserIsBot: member => {
        // mudei pra essa verificação, pq verificar pela role abre brecha pra alguém
        // se colocar como bot e ser ignorado pelo cafe-bot.
        return (!member || member.user.bot);
        // a verificação antiga ->
        //return member.roles.some(r => ["bot"].includes(r.name));
    }
};