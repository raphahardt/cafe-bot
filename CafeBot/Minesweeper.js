
const utils = require('../utils');
let insideCount = {};

const Cafebase = require('./Cafebase');
const InteractivePrompt = require('./Util/InteractivePrompt');

const MINE_NUMBERS = {
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
};

class Minesweeper {
    constructor () {
        //this.db = new Cafebase('teste');
    }

    get modName() { return 'minesweeper' }

    mineCommand(message, args) {

    }

    commands() {
        return {
            'mine': this.mineCommand
        }
    }

    events() {
        return {}
    }
}

class MineCell {
    constructor (grid, x, y) {
        this.grid = grid;
        this.x = x;
        this.y = y;
        this.mine = false;
        this.totalMines = 0;
    }

    countMines() {
        if (this.mine) {
            this.totalMines = -1;
            return;
        }
        let total = 0;
        for (let xoff = -1; xoff <= 1; xoff++) {
            let celli = i + xoff;
            if (celli < 0 || celli >= cols) continue;

            for (let yoff = -1; yoff <= 1; yoff++) {
                let cellj = j + yoff;
                if (cellj < 0 || cellj >= rows) continue;

                const neighbor = this.grid[celli][cellj];
                if (neighbor.mine) {
                    total++;
                }
            }
        }
        this.totalMines = total;
    }

    show() {
        if (this.mine) {
            return ':bomb:';
        } else {
            if (this.totalMines) {
                return `:${MINE_NUMBERS[this.totalMines]}:`
            }
            return ':r0:';
        }
    }
}

module.exports = Minesweeper;