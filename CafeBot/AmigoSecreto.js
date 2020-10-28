
const utils = require('../utils');
const fs = require('fs');
const Discord = require("discord.js");

// nome do arquivo de amigos
const amigosDatabase = './amigos.txt';

/**
 * Modulo que vai cuidar de cadastrar e sortear o amigo secreto
 */
class AmigoSecreto {
    constructor () {}

    get modName() { return 'amigosecreto' }

    /**
     *
     * @param {Discord.Message} message
     * @param args
     */
    static cleanAmigoCommand(message, args) {
        if (!verifyIfAdmin(message.member)) {
            message.channel.send(`Você precisa ser moderador pra executar esse comando.`);
            return;
        }

        fs.unlink(amigosDatabase, err => {
            if (err) {
                return console.log('erro ao limpar o amigosdatabase', err);
            }
            message.channel.send(`Lista de amigos excluída.`);
            console.log('LIMPOU AMIGOS');
        })
    }

    /**
     *
     * @param {Discord.Message} message
     * @param args
     */
    static addAmigoCommand(message, args) {
        const memberId = args[0] || message.member.id;

        fs.readFile(amigosDatabase, (err, data) => {
            //if (err) return console.log('erro ao abrir o amigosdatabase', err);

            // se já esta cadastrado, não fazer nada
            if ((data || new Buffer('')).includes(memberId)) {
                message.channel.send(`${message.member} já cadastrado.`);
                return;
            }

            // adiciona no arquivo
            fs.open(amigosDatabase, 'a', (err, fd) => {
                if (err) {
                    return console.log('erro ao criar o amigosdatabase', err);
                }

                const buffer = new Buffer(memberId + "\n");
                fs.write(fd, buffer, 0, buffer.length, null, err => {
                    if (err) return console.log('erro ao adicionar no amigosdatabase', err);
                    fs.close(fd, () => {
                        message.channel.send(`${message.member} tá participando agora!`);
                        console.log('ADICIONOU AMIGO', message.member.username);
                    })
                });
            });
        });

    }

    /**
     *
     * @param {Discord.Message} message
     * @param args
     */
    static removeAmigoCommand(message, args) {
        const memberId = args[0] || message.member.id;

        fs.readFile(amigosDatabase, (err, data) => {
            if (err) return;

            let amigosList = data.toString().split(/\n/);

            // deleta da lista
            amigosList.splice(amigosList.indexOf(memberId), 1);

            fs.writeFile(amigosDatabase, new Buffer(amigosList.join("\n")), err => {
                if (err) return console.log('erro ao remover do amigosdatabase', err);
                message.channel.send(`${message.member} não tá mais participando.`);
                console.log('REMOVEU AMIGO', message.member.username);
            })
        });

    }

    /**
     *
     * @param {Discord.Message} message
     * @param args
     */
    static shuffleAmigoCommand(message, args) {
        if (!verifyIfAdmin(message.member)) {
            message.channel.send(`Você precisa ser moderador pra executar esse comando.`);
            return;
        }

        fs.readFile(amigosDatabase, (err, data) => {
            if (err || !data.length) {
                message.channel.send(`Não há nenhum amigo para ser sorteado.`);
                return;
            }

            let amigosList = data.toString().split(/\n/);

            amigosList.forEach(amigoId => {
                if (!amigoId) return;
                // produta o usuario pelo id
                message.client.users.fetch(amigoId)
                    .then(user => {
                        console.log('criando dm entre usuario ' + user.username);
                        return user.createDM();
                    })
                    .then(dmChannel => {
                        // TODO: terminar
                        console.log('mandando mensagem para ' + dmChannel.recipient.username);
                        //dmChannel.send('teste');
                    })
                    .catch(err => {
                        console.log(err);
                    })
            });
        });

    }

    static commands() {
        return {
            'amigoClean': AmigoSecreto.cleanAmigoCommand,
            'amigoAdd': AmigoSecreto.addAmigoCommand,
            'amigoRemove': AmigoSecreto.removeAmigoCommand,
            'amigoSorteio': AmigoSecreto.shuffleAmigoCommand
        }
    }

    static events() {
        return {}
    }
}

function verifyIfAdmin(member) {
    return member.roles.cache.some(r => ["Manage Server"].includes(r.name));
}

module.exports = AmigoSecreto;
