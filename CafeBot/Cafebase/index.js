
const fbAdmin = require("firebase-admin");
const fbServiceAccount = require("../../misc/cafebot-2018-firebase-adminsdk-j17ic-a11e9f3222.json");

const fbApp = fbAdmin.initializeApp({
    credential: fbAdmin.credential.cert(fbServiceAccount),
    databaseURL: "https://cafebot-2018.firebaseio.com"
}, 'db');

const fbDb = fbApp.database();

class Cafebase {
    constructor(ref) {
        this.ref = fbDb.ref(ref);
    }

    save(path, value) {
        return new Promise((resolve, reject) => {
            this.ref.child(path).set(value, err => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(value);

                // this.ref.child(path).once('value', ss => {
                //     resolve(ss.val());
                // }, err => {
                //     reject(err);
                // });
            });
        });
    }

    delete(path) {
        return this.getOne(path)
            .then(oldValue => {
                return this.save(path, null)
                    .then(() => {
                        return oldValue;
                    })
                ;
            })
        ;
    }

    insert(path, value) {
        return new Promise((resolve, reject) => {
            let saved = this.ref.child(path).push();
            value.id = saved.key;

            saved.set(value, err => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(value);

                // saved.once('value', ss => {
                //     resolve(ss.val());
                // }, err => {
                //     reject(err);
                // });
            });
        });
    }

    /**
     * Retorna todos os valores de um path.
     *
     * @param path
     * @param defaultValue
     * @return {Promise<any>}
     */
    getAll(path, defaultValue) {
        return new Promise((resolve, reject) => {
            this.ref.child(path).once('value', snapshot => {
                const value = snapshot.exists() ? snapshot.val() : defaultValue;

                resolve(value);
            }, err => {
                reject(err);
            });
        });
    }

    /**
     * Retorna todos os valores de um path, mas sempre retorna um array.
     * Útil para listas.
     *
     * @param path
     * @return {Promise<Array>}
     */
    getArray(path) {
        return this.getAll(path)
            .then(value => {
                if (Array.isArray(value)) {
                    return value;
                }

                let newValue = [];
                for (let key in value) {
                    if (!value.hasOwnProperty(key)) continue;

                    newValue.push(value[key]);
                }

                return newValue;
            })
        ;
    }

    /**
     * Retorna o unico valor de um path. Útil para pegar valor de config ou info, por exemplo.
     *
     * @param path
     * @param defaultObject
     * @return {Promise<Object>}
     */
    getOne(path, defaultObject) {
        return new Promise((resolve, reject) => {
            this.ref.child(path).once('value', snapshot => {
                let value = snapshot.exists() ? snapshot.val() : null;

                if (defaultObject !== undefined) {
                    if (value === null) {
                        value = {};
                    }
                    for (let key in defaultObject) {
                        if (!defaultObject.hasOwnProperty(key)) continue;

                        if (!snapshot.child(key).exists()) {
                            value[key] = defaultObject[key];
                        }
                    }
                }

                resolve(value);
            }, err => {
                reject(err);
            });
        });
        // return this.getAll(path, {})
        //     .then(object => {
        //         for (let key in defaultObject) {
        //             if (!defaultObject.hasOwnProperty(key)) continue;
        //
        //             if (object[key] === undefined) {
        //                 object[key] = defaultObject[key];
        //             }
        //         }
        //
        //         return object;
        //     });
    }

    /**
     * Encontra todos os valores de um path de acordo com um filtro.
     *
     * @param pathParent
     * @param filterCb
     * @param defaultValueIfNull
     * @return {Promise<Array>}
     */
    findAll(pathParent, filterCb, defaultValueIfNull) {
        return this.getAll(pathParent, defaultValueIfNull)
            .then(value => {
                if (value === null) {
                    return [];
                }
                let founds = [];
                if (Array.isArray(value)) {
                    for (let i = 0; i < value.length; i++) {
                        if (filterCb(value[i], i)) {
                            founds.push(value[i]);
                        }
                    }
                } else {
                    for (let key in value) {
                        if (!value.hasOwnProperty(key)) continue;

                        if (filterCb(value[key], key)) {
                            founds.push(value[key]);
                        }
                    }
                }
                return founds;
            })
    }

    /**
     * Retorna um valor de uma lista de valores de acordo com um filtro,
     * mas só retorna se ele for o único e exclusivo valor encontrado.
     *
     * @param pathParent
     * @param filterCb
     * @param defaultValueIfNull
     * @return {Promise<any>}
     */
    findOne(pathParent, filterCb, defaultValueIfNull) {
        return this.findAll(pathParent, filterCb, defaultValueIfNull)
            .then(found => {
                if (found.length === 1) {
                    return found.shift();
                }

                return null;
            })
    }

    /**
     * Pega os dados em tempo real e chama o callback toda vez que
     * os dados forem alterados.
     *
     * @param path
     * @param callback
     * @param defaultValue
     * @return {function} Função que cancela se for chamado.
     */
    getLive(path, callback, defaultValue) {
        const fn = this.ref.child(path).on('value', snapshot => {
            const value = snapshot.val() || defaultValue;

            callback(value);
        });

        return (function (db, path, fn) {
            return function() {
                db.ref.child(path).off('value', fn);
            }
        }(this, path, fn));
    }
}

module.exports = Cafebase;