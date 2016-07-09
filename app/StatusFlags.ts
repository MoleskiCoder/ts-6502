"use strict";

import {StatusBits} from "./StatusBits";

/* tslint:disable:no-bitwise */

export class StatusFlags {

    private _negative: boolean;
    private _overflow: boolean;
    private _reserved: boolean;
    private _break: boolean;
    private _decimal: boolean;
    private _interrupt: boolean;
    private _zero: boolean;
    private _carry: boolean;

    constructor(value: number) {
        this.Negative = (value & StatusBits.Negative) !== 0;
        this.Overflow = (value & StatusBits.Overflow) !== 0;
        this.Reserved = (value & StatusBits.Reserved) !== 0;
        this.Break = (value & StatusBits.Break) !== 0;
        this.Decimal = (value & StatusBits.Decimal) !== 0;
        this.Interrupt = (value & StatusBits.Interrupt) !== 0;
        this.Zero = (value & StatusBits.Zero) !== 0;
        this.Carry = (value & StatusBits.Carry) !== 0;
    }

    public get Negative(): boolean          { return this._negative;    }
    public set Negative(value: boolean)     { this._negative = value;   }

    public get Overflow(): boolean          { return this._overflow;    }
    public set Overflow(value: boolean)     { this._overflow = value;   }

    public get Reserved(): boolean          { return this._reserved;    }
    public set Reserved(value: boolean)     { this._reserved = value;   }

    public get Break(): boolean             { return this._break;       }
    public set Break(value: boolean)        { this._break = value;      }

    public get Decimal(): boolean           { return this._decimal;     }
    public set Decimal(value: boolean)      { this._decimal = value;    }

    public get Interrupt(): boolean         { return this._interrupt;   }
    public set Interrupt(value: boolean)    { this._interrupt = value;  }

    public get Zero(): boolean              { return this._zero;        }
    public set Zero(value: boolean)         { this._zero = value;       }

    public get Carry(): boolean             { return this._carry;       }
    public set Carry(value: boolean)        { this._carry = value;      }

    public toString(): string {
        let returned: string = "";
        returned += this.Negative ? "N" : "-";
        returned += this.Overflow ? "O" : "-";
        returned += this.Reserved ? "R" : "-";
        returned += this.Break ? "B" : "-";
        returned += this.Decimal ? "D" : "-";
        returned += this.Interrupt ? "I" : "-";
        returned += this.Zero ? "Z" : "-";
        returned += this.Carry ? "C" : "-";
        return returned;
    }

    public toNumber(): number {
        let flags: StatusBits = 0;
        if (this.Negative) {
            flags |= StatusBits.Negative;
        }
        if (this.Overflow) {
            flags |= StatusBits.Overflow;
        }
        if (this.Reserved) {
            flags |= StatusBits.Reserved;
        }
        if (this.Break) {
            flags |= StatusBits.Break;
        }
        if (this.Decimal) {
            flags |= StatusBits.Decimal;
        }
        if (this.Interrupt) {
            flags |= StatusBits.Interrupt;
        }
        if (this.Zero) {
            flags |= StatusBits.Zero;
        }
        if (this.Carry) {
            flags |= StatusBits.Carry;
        }
        return flags;
    }
}
