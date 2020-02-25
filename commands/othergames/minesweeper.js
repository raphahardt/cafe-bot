const commando = require('discord.js-commando');
// const { oneLine } = require('common-tags');
const utils = require('../../utils');

class MineNeighborFinder {
    constructor(mode = 'normal') {
        if (mode === 'normal') {
            this.mode = 'Normal';
        } else if (mode === 'knight') {
            this.mode = 'Knight';
        }
    }

    *iterate() {
        yield* this['iterate' + this.mode]();
    }

    *iterateNormal() {
        for (let xoff = -1; xoff <= 1; xoff++) {
            for (let yoff = -1; yoff <= 1; yoff++) {
                yield [xoff, yoff, 1];
            }
        }
    }

    *iterateKnight() {
        yield [-2, 1, 1];
        yield [2, 1, 1];
        yield [-1, 2, 1];
        yield [1, 2, 1];
        yield [-2, -1, 1];
        yield [2, -1, 1];
        yield [-1, -2, 1];
        yield [1, -2, 1];
    }
}

class MineGrid {
    constructor(cols, rows, mines, mode = 'normal') {
        this.cols = cols;
        this.rows = rows;
        this.len = cols * rows;
        this.mines = mines;
        this.grid = null;
        this.finder = new MineNeighborFinder(mode);
    }

    createGrid() {
        let optionsForMines = [];

        this.grid = new Array(this.len);

        for (let k = 0; k < this.len; k++) {
            const x = Math.floor(k / this.cols);
            const y = k % this.cols;

            this.grid[k] = new MineCell(this, x, y);

            optionsForMines.push(k);
        }

        // preenche as minas
        optionsForMines = utils.shuffle(optionsForMines);
        for (let n = 0; n < this.mines; n++) {
            const optK = optionsForMines.shift();
            this.grid[optK].mine = true;
        }

        // conta os vizinhos
        for (let k = 0; k < this.len; k++) {
            this.grid[k].countMines();
        }
    }

    revealFirstMove() {
        for (let k = 0; k < this.len; k++) {
            if (this.grid[k].totalMines === 0) {
                this.grid[k].floodFill();
                return;
            }
        }
    }

    cell(x, y) {
        if (y < 0 || y >= this.cols) return null;
        if (x < 0 || x >= this.rows) return null;

        const k = x * this.cols + y;
        return this.grid[k];
    }

    toString(debug = false) {
        let text = '';
        for (let k = 0; k < this.len; k++) {
            if (k % this.cols === 0) {
                text += "\n";
            }
            let cellText = this.grid[k].toString();
            if (!debug && !this.grid[k].visible) {
                cellText = '||' + cellText + '||';
            }
            text += cellText;
        }
        return text;
    }
}

class MineCell {
    constructor (grid, x, y) {
        this.grid = grid;
        this.x = x;
        this.y = y;
        this.mine = false;
        this.totalMines = 0;
        this.visible = false;

        this.emojiNumbers = {
            0: 'zero',
            1: 'one',
            2: 'two',
            3: 'three',
            4: 'four',
            5: 'five',
            6: 'six',
            7: 'seven',
            8: 'eight',
        }
    }

    countMines() {
        if (this.mine) {
            this.totalMines = -1;
            return;
        }
        let total = 0;
        for (let coord of this.grid.finder.iterate()) {
            const x = this.x + coord[0];
            const y = this.y + coord[1];
            const neighbor = this.grid.cell(x, y);

            if (neighbor === null) continue;

            if (neighbor.mine) {
                total += coord[2];
            }
        }
        this.totalMines = total;
    }

    floodFill() {
        for (let coord of this.grid.finder.iterate()) {
            const x = this.x + coord[0];
            const y = this.y + coord[1];
            const neighbor = this.grid.cell(x, y);

            if (neighbor === null) continue;

            if (!neighbor.visible) {
                neighbor.visible = true;
                if (neighbor.totalMines === 0) {
                    neighbor.floodFill();
                }
            }
        }
    }

    toString() {
        if (this.mine) {
            return ':bomb:';
        } else {
            if (this.totalMines) {
                return `:${this.emojiNumbers[this.totalMines]}:`
            }
            return '<:r0:461676744185741322>';
        }
    }
}

module.exports = class MinesweeperCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'minesweeper',
            aliases: [
                'mine', 'bomba', 'bomb'
            ],
            group: 'othergames',
            memberName: 'minesweeper',
            description: 'Sei lá, preguiça de explicar.',
            examples: ['minesweeper'],

            args: [
                {
                    key: 'difficulty',
                    label: 'difficulty',
                    prompt: 'Qual a dificuldade?',
                    oneOf: ['easy', 'medium', 'hard', 'insane'],
                    default: 'easy',
                    type: 'string'
                },
                {
                    key: 'mode',
                    label: 'mode',
                    prompt: 'Qual o modo?',
                    oneOf: ['normal', 'knight'],
                    default: 'normal',
                    type: 'string'
                }
            ]
        });

        this.difficultiesGrids = {
            'easy': [7, 5, 6],
            'medium': [13, 9, 21],
            'hard': [20, 13, 50],
            'insane': [25, 20, 120],
        }
    }

    async run(msg, args ) {
        const cols = this.difficultiesGrids[args.difficulty][0];
        const rows = this.difficultiesGrids[args.difficulty][1];
        const mines = this.difficultiesGrids[args.difficulty][2];
        let grid = new MineGrid(cols, rows, mines, args.mode);

        grid.createGrid();
        grid.revealFirstMove();

        return utils.longMessage(msg).reply(grid.toString());
    }
};