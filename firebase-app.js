const admin = require("firebase-admin");

const serviceAccount = require("./misc/cafebot-dev-firebase-adminsdk-rq78u-ef84e9d980.json");

module.exports = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://cafebot-dev.firebaseio.com"
});