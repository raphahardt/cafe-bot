
let _interpretersList = [
    require('./LeveiUmTiroInterpreter'),
    require('./RandomInterpreter')
];

// ordenar por ordem de prioridade
_interpretersList.sort(function (a, b) {
    return b.priority - a.priority;
});

module.exports = _interpretersList;