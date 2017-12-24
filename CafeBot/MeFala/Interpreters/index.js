
let _interpretersList = [
    require('./LeveiUmTiroInterpreter'),
    require('./MegaSenaInterpreter'),
    require('./BaileFunkInterpreter'),
    require('./SignoInterpreter'),
    require('./CorInterpreter'),
    require('./ComerInterpreter'),
    require('./MelhorDoQueInterpreter'),
    require('./AfrontaInterpreter'),
    require('./TudoBemInterpreter'),
    require('./ComoVaiSerAlgoInterpreter'),
    require('./OmaeMouShinderuInterpreter'),
    require('./PassarosInterpreter'),
    require('./PorcoOtarioInterpreter'),
    require('./QuantosInterpreter'),
    require('./PalavraInterpreter'),
    require('./FelinosInterpreter'),
    require('./UiCaIuInterpreter'),
    require('./RandomInterpreter')
];

// ordenar por ordem de prioridade
_interpretersList.sort(function (a, b) {
    return b.priority - a.priority;
});

module.exports = _interpretersList;