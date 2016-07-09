"use strict";

import {ByteEventArgs} from "./ByteEventArgs";

export class AddressEventArgs extends ByteEventArgs {

    private _address: number;

    constructor(address: number, cell: number) {
        super(cell);
        this._address = address;
    }

    public get Address(): number { return this._address;    }
}
