"use strict";

import {MOS6502} from "./mos6502";
import {Symbols} from "./Symbols";
import {AddressingMode} from "./AddressingMode";
import {Instruction} from "./Instruction";
import {AddressingModeDumper} from "./AddressingModeDumper";

export class Disassembly {

    private _processor: MOS6502;
    private _symbols: Symbols;
    private _dumpers: { [mode: number]: AddressingModeDumper; } = {};

    public static Dump_ByteValue(value: number): string {
        return Disassembly.pad(value, 2, 16);
    }

    public static Dump_WordValue(value: number): string {
        return Disassembly.pad(value, 4, 16);
    }

    public static pad(value: number, width: number, base?: number, zero?: string): string {
        if (base === undefined) {
            base = 10;
        }
        if (zero === undefined) {
            zero = "0";
        }
        let converted: string = value.toString(base);
        let length: number = converted.length;
        return length >= width ? converted : new Array(width - length + 1).join(zero) + converted;
    }

    private static Dump_Nothing(unused: number ): string {
        return "";
    }

    private static Dump_A(unused: number): string {
        return "A";
    }

    constructor(processor: MOS6502 , symbols: Symbols ) {
        this._processor = processor;
        this._symbols = symbols;

        this._dumpers[AddressingMode.Illegal] = new AddressingModeDumper(Disassembly.Dump_Nothing, Disassembly.Dump_Nothing);
        this._dumpers[AddressingMode.Implied] = new AddressingModeDumper(Disassembly.Dump_Nothing, Disassembly.Dump_Nothing);
        this._dumpers[AddressingMode.Accumulator] = new AddressingModeDumper(Disassembly.Dump_Nothing, Disassembly.Dump_A);
        this._dumpers[AddressingMode.Immediate] = new AddressingModeDumper(this.Dump_Byte, this.Dump_imm);
        this._dumpers[AddressingMode.Relative] = new AddressingModeDumper(this.Dump_Byte, this.Dump_rel);
        this._dumpers[AddressingMode.XIndexed] = new AddressingModeDumper(this.Dump_Byte, this.Dump_xind);
        this._dumpers[AddressingMode.IndexedY] = new AddressingModeDumper(this.Dump_Byte, this.Dump_indy);
        this._dumpers[AddressingMode.ZeroPageIndirect] = new AddressingModeDumper(this.Dump_Byte, this.Dump_zpind);
        this._dumpers[AddressingMode.ZeroPage] = new AddressingModeDumper(this.Dump_Byte, this.Dump_zp);
        this._dumpers[AddressingMode.ZeroPageX] = new AddressingModeDumper(this.Dump_Byte, this.Dump_zpx);
        this._dumpers[AddressingMode.ZeroPageY] = new AddressingModeDumper(this.Dump_Byte, this.Dump_zpy);
        this._dumpers[AddressingMode.Absolute] = new AddressingModeDumper(this.Dump_DByte, this.Dump_abs);
        this._dumpers[AddressingMode.AbsoluteX] = new AddressingModeDumper(this.Dump_DByte, this.Dump_absx);
        this._dumpers[AddressingMode.AbsoluteY] = new AddressingModeDumper(this.Dump_DByte, this.Dump_absy);
        this._dumpers[AddressingMode.AbsoluteXIndirect] = new AddressingModeDumper(this.Dump_DByte, this.Dump_absxind);
        this._dumpers[AddressingMode.Indirect] = new AddressingModeDumper(this.Dump_DByte, this.Dump_ind);
        this._dumpers[AddressingMode.ZeroPageRelative] = new AddressingModeDumper(this.Dump_DByte, this.Dump_zprel);
    }

    public DumpBytes(mode: AddressingMode, current: number): string {
        return this._dumpers[mode].ByteDumper.apply(this, [ current ]);
    }

    public Disassemble(current: number): string  {
        let content: number = this._processor.GetByte(current);
        let instruction: Instruction = this._processor.Instructions[content];

        let mode: AddressingMode = instruction.Mode;
        let mnemonic: string = instruction.Display;

        let operand: string = this.DumpOperand(mode, current + 1);

        let label: string = (<any>this._symbols.Labels)[current];
        if (label === undefined) {
            return `${mnemonic} ${operand}`;
        }
        return `${label}: ${mnemonic} ${operand}`;
    }

    public DumpOperand(mode: AddressingMode, current: number): string {
        return this._dumpers[mode].DisassemblyDumper.apply(this, [ current ]);
    }

    ////

    private GetByte(address: number): number {
        return this._processor.GetByte(address);
    }

    private GetWord(address: number): number {
        return this._processor.GetWord(address);
    }

    ////

    private Dump_Byte(address: number): string {
        return Disassembly.Dump_ByteValue(this.GetByte(address));
    }

    private Dump_DByte(address: number): string {
        return this.Dump_Byte(address) + this.Dump_Byte(address + 1);
    }

    ////

    private ConvertWordAddress(address: number): string {
        let label: string = (<any>this._symbols.Labels)[address];
        if (label === undefined) {
            return `$${Disassembly.pad(address, 4, 16)}`;
        }
        return label;
    }

    private ConvertByteAddress(address: number): string {
        let label: string = (<any>this._symbols.Labels)[address];
        if (label === undefined) {
            return `$${Disassembly.pad(address, 2, 16)}`;
        }
        return label;
    }

    // private ConvertWordConstant(constant: number): string {
    //     let label: string = (<any>this._symbols.Constants)[constant];
    //     if (label === undefined) {
    //         return `$${Disassembly.pad(constant, 4, 16)}`;
    //     }
    //     return label;
    // }

    private ConvertByteConstant(constant: number): string {
        let label: string = (<any>this._symbols.Constants)[constant];
        if (label === undefined) {
            return `$${Disassembly.pad(constant, 2, 16)}`;
        }
        return label;
    }

    ////

    private Dump_imm(current: number): string {
        let immediate: number = this.GetByte(current);
        return `#${this.ConvertByteConstant(immediate)}`;
    }

    private Dump_abs(current: number): string {
        let address: number = this.GetWord(current);
        return this.ConvertWordAddress(address);
    }

    private Dump_zp(current: number): string {
        let zp: number = this.GetByte(current);
        return this.ConvertByteAddress(zp);
    }

    private Dump_zpx(current: number): string {
        let zp: number = this.GetByte(current);
        return `${this.ConvertByteAddress(zp)},X`;
    }

    private Dump_zpy(current: number): string {
        let zp: number = this.GetByte(current);
        return `${this.ConvertByteAddress(zp)},Y`;
    }

    private Dump_absx(current: number): string {
        let address: number = this.GetWord(current);
        return `${this.ConvertWordAddress(address)},X`;
    }

    private Dump_absy(current: number): string {
        let address: number = this.GetWord(current);
        return `${this.ConvertWordAddress(address)},Y`;
    }

    private Dump_absxind(current: number): string {
        let address: number = this.GetWord(current);
        return `(${this.ConvertWordAddress(address)},X)`;
    }

    private Dump_xind(current: number): string {
        let zp: number = this.GetByte(current);
        return `(${this.ConvertByteAddress(zp)},X)`;
    }

    private Dump_indy(current: number): string {
        let zp: number = this.GetByte(current);
        return `(${this.ConvertByteAddress(zp)}),Y`;
    }

    private Dump_ind(current: number): string {
        let address: number = this.GetWord(current);
        return `(${this.ConvertWordAddress(address)})`;
    }

    private Dump_zpind(current: number): string {
        let zp: number = this.GetByte(current);
        return `(${this.ConvertByteAddress(zp)})`;
    }

    private Dump_rel(current: number): string {
        let relative: number = 1 + current + this.GetByte(current);
        return this.ConvertWordAddress(relative);
    }

    private Dump_zprel(current: number): string {
        let zp: number = this.GetByte(current);
        let displacement: number = this.GetByte(current + 1);
        let address: number = 1 + current + displacement;
        return `${this.ConvertByteAddress(zp)},${this.ConvertWordAddress(address)}`;
    }
}
