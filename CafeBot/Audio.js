
const youtubeStream = require('ytdl-core');

// FIXME: ISSO NÃO FUNCIONA SE O BOT TIVER EM MULTIPLAS GUILDS!!!
let playing = null;
let voiceChatConnected = null;

class Audio {
    constructor () {}

    static get modName() { return 'audio' }

    static playCommand(message, args) {
        // se foi um 'play' só pra fazer a musica voltar
        if (playing && args.length === 0) {
            if (playing.paused) {
                playing.resume();
            }
            return;
        }

        // se a mensagem não vier de uma guild (um server), ignorar,
        // bots só entram em canais de voice de guilds
        if (!message.guild) return;

        // se o membro não estiver num canal de voz, como
        // saber qual canal o bot vai dar join?
        if (!message.member.voiceChannel) {
            message.reply('Você precisa estar num canal de voz primeiro.');
            return;
        }

        if (!message.member.voiceChannel.joinable) {
            message.reply('Eu não tenho permissão pra entrar nesse canal.');
            return;
        }

        message.member.voiceChannel.join()
            .then(connection => { // Connection is an instance of VoiceConnection
                let msgUpdate;
                message.reply('Tocando...').then(msg => {
                    msgUpdate = msg;
                }).catch(console.error);
                voiceChatConnected = connection;

                const ytUrl = "https://www.youtube.com/watch?v=" + args[0];
                let progressInfo = { downloaded: 0, total: 1 };
                let interv;
                const stream = youtubeStream(ytUrl, { quality: 'lowest', filter: 'audioonly' });
                const dispatcher = connection.playStream(stream, {seek: 0, volume: 1});

                youtubeStream.getInfo(ytUrl).then(info => {
                    let seekTime = 0;
                    interv = message.client.setInterval(() => {
                        if (!msgUpdate) return;

                        if (!playing.paused) {
                            seekTime++;
                        }

                        msgUpdate.edit(progressBar(seekTime, info.length_seconds, progressInfo.downloaded, progressInfo.total));
                    }, 1000);
                }).catch(console.error);

                dispatcher.on('end', () => {
                    if (interv) {
                        message.client.clearInterval(interv);
                    }

                    // a musica terminou
                    if (!msgUpdate) return;
                    msgUpdate.edit('Música acabou');

                    message.client.setTimeout(() => {
                        // desconecta depois de alguns segundos sem tocar nada
                        connection.disconnect();
                    }, 5000)
                });

                stream.on('progress', (chunk, downloaded, total) => {
                    // toda vez que for recebido um chunk
                    progressInfo.downloaded = downloaded;
                    progressInfo.total = total;
                });

                dispatcher.on('error', e => {
                    // em caso de erros
                    console.error(e);
                });

                playing = dispatcher;
            })
            .catch(console.error);
    }

    static pauseCommand(message, args) {
        if (!playing) return;

        if (!playing.paused) {
            playing.pause();
        } else {
            // FIXME: faz sentido tocar no +pause?
            playing.resume();
        }
    }

    static stopCommand(message, args) {
        if (playing) {
            playing.end();
            playing = null;
        }

        // se esse nodejs está sabendo qual voice chat ele tá conectado, então
        // disconecta desse (NÃO FUNCIONA EM MULTIPLAS GUILDS!!! TERIA QUE ADAPTAR)
        if (voiceChatConnected) {
            voiceChatConnected.disconnect();
        }

        // se o membro não estiver num canal de voz, como
        // saber qual canal o bot vai dar join?
        if (!message.member.voiceChannel) {
            message.reply('Você precisa estar num canal de voz primeiro.');
            return;
        }

        message.member.voiceChannel.leave();
    }

    // invocado quando o modulo é desativado via +mod
    static onDisable() {
        if (playing) {
            playing.end();
            playing = null;
        }

        // se esse nodejs está sabendo qual voice chat ele tá conectado, então
        // disconecta desse (NÃO FUNCIONA EM MULTIPLAS GUILDS!!! TERIA QUE ADAPTAR)
        if (voiceChatConnected) {
            voiceChatConnected.disconnect();
        }
    }

    static commands() {
        return {
            'play': Audio.playCommand,
            'pause': Audio.pauseCommand,
            'stop': Audio.stopCommand,
        }
    }
}

function progressBar(seek, totalSeek, downloaded, totalDownload) {
    //console.log('SEEK', seek, totalSeek);
    const stringLen = 30;
    const numDownloaded = parseInt((downloaded / Math.max(1,totalDownload)) * stringLen);
    const posSeek = totalSeek ? parseInt((seek / totalSeek) * stringLen) : 0;
    let p = '';
    for (let i = 0; i < stringLen; i++) {
        if (i <= posSeek) {
            p += '▓';
        } else if (i <= numDownloaded) {
            p += "▒";
        } else {
            p += "░";
        }
    }

    const perc = parseInt((downloaded / Math.max(1,totalDownload)) * 100);
    return p + ` (${perc}%)`;
}

module.exports = Audio;