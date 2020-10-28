const PermissionError = require('./Errors/PermissionError');

const { Attachment, MessageEmbed } = require('discord.js');
const utils = require('../utils');
const adminsIds = require('../adminIds');

const weather = require('weather-js');

class Tempo {
    constructor () {
        this.requests = {};
    }

    get modName() { return 'tempo' }

    previsaoCommand(message, args) {
        return this.tempoCommand(message, ['--all'].concat(args));
    }

    tempoCommand(message, args) {
        return new Promise((resolve, reject) => {
            let all = false;
            if (args[0] === '--all') {
                all = true;
                args.shift();
            }
            const query = args.join(' ');
            weather.find({search: query, degreeType: 'C', lang: 'pt-BR'}, function(err, result) {
                if (err) reject(err);

                result = result[0];

                let text = '';
                const city = result.location.name;
                const degreeType = ' º' + result.location.degreetype;

                const sky = result.current.skytext;
                const temp = result.current.temperature + degreeType;
                const tempSensation = result.current.feelslike + degreeType;
                const humidity = result.current.humidity + '%';
                const wind = result.current.windspeed;

                text += ''
                    + `*${sky}*\n`
                    + `**Temp:** ${temp} (sensação de ${tempSensation})\n`
                    + `**Umidade:** ${humidity}\n`
                    + `**Vento:** ${wind}\n`
                ;

                const emb = new MessageEmbed()
                    .setColor(0x44d8e5)
                    .setTitle('🦉 Tempo em ' + city)
                    .setThumbnail(result.current.imageUrl)
                    .setDescription(text)
                ;

                if (all) {
                    // separador
                    emb.addField(':wavy_dash:', ':calendar: Previsão da semana', false);

                    // let embs = [];
                    for (let i = 0; i < result.forecast.length; i++) {
                        const f = result.forecast[i];
                        let fText = ''
                            + `*${f.skytextday}*\n`
                            + `**min**: ${f.low}${degreeType}\n`
                            + `**max**: ${f.high}${degreeType}\n`
                            + `**precip**: ${f.precip}%\n`
                        ;
                        emb.addField(f.shortday, fText, true);
                    }
                }

                message.channel.send(emb);
            });
        });
    }

    commands() {
        return {
            'tempo': this.tempoCommand,
            'previsao': this.previsaoCommand,
        }
    }
}

module.exports = Tempo;
