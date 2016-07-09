"use strict";

export class ByteEventArgs {

    private _cell: number;

    constructor(cell: number) {
        this._cell = cell;
    }

    public get Cell(): number {
        return this._cell;
    }
}
