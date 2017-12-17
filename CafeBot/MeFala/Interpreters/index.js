
let _interpretersList = [
    require('./LeveiUmTiroInterpreter'),
    require('./TudoBemInterpreter'),
    require('./ComoVaiSerAlgoInterpreter'),
    require('./OmaeMouShinderuInterpreter'),
    require('./PassarosInterpreter'),
    require('./FelinosInterpreter'),
    require('./UiCaIuInterpreter'),
    require('./RandomInterpreter')
];

// ordenar por ordem de prioridade
_interpretersList.sort(function (a, b) {
    return b.priority - a.priority;
});

module.exports = _interpretersList;