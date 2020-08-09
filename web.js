const express = require('express');
const routes = require('./routes/index');
const path = require('path');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use('/', routes);

const server = app.listen(8000, () => {
    console.log(`Express is running on port ${server.address().port}`);
});
