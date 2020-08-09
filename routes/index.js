const express = require('express');
const path = require('path')

const router = express.Router();

router.get('/', (req, res) => {
    res.render('mefala')
});

module.exports = router;
