"use strict";

import {IImplementation} from "./IImplementation";
import {AddressingMode} from "./AddressingMode";

export class Instruction {

    private _vector: IImplementation;
    private _count: number;
    private _mode: AddressingMode;
    private _display: string;

    constructor(vector: IImplementation, count: number, mode: AddressingMode, display: string) {
        this._vector = vector;
        this._count = count;
        this._mode = mode;
        this._display = display;
    }

    public get Vector(): IImplementation {
        return this._vector;
    }

    public get Count(): number {
        return this._count;
    }

    public get Mode(): AddressingMode {
        return this._mode;
    }

    public get Display(): string {
        return this._display;
    }
}
