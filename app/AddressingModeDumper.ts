"use strict";

import {IDumper} from "./IDumper";

export class AddressingModeDumper {

    private _byteDumper: IDumper ;
    private _disassemblyDumper: IDumper ;

    constructor(byteDumper: IDumper, disassemblyDumper: IDumper) {
        this._byteDumper = byteDumper;
        this._disassemblyDumper = disassemblyDumper;
    }

    public get ByteDumper(): IDumper {
        return this._byteDumper;
    }

    public get DisassemblyDumper(): IDumper {
        return this._disassemblyDumper;
    }
}
