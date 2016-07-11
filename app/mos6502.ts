"use strict";

import {StatusFlags} from "./StatusFlags";
import {ProcessorType} from "./ProcessorType";
import {Instruction} from "./Instruction";
import {IImplementation} from "./IImplementation";
import {AddressingMode} from "./AddressingMode";

/* tslint:disable:no-bitwise */

export abstract class MOS6502 {

    private _pc: number;    // program counter
    private _x: number;     // index register X
    private _y: number;     // index register Y
    private _a: number;     // accumulator
    private _s: number;     // stack pointer

    private _p: StatusFlags; // processor status

    private _cycles: number;
    private _level: ProcessorType;

    private _instructions: Instruction[];
    private _overlay6502: Instruction[];
    private _overlay65sc02: Instruction[];
    private _overlay65c02: Instruction[];

    private _proceed: boolean = true;

    private static toSignedByte(unsigned: number): number {
        console.assert((unsigned & ~0xff) === 0);
        let unsignedPart: number = unsigned & 0x7f;
        let signedPart: number = unsigned & 0x80;
        let returnValue: number = unsignedPart - signedPart;
        console.assert((returnValue >= -128) && (returnValue <= 127));
        return returnValue;
    }

    private static toUnsignedByte(signed: number): number {
        return MOS6502.LowByte(signed);
    }

    private static INS(method: IImplementation, cycles: number, addressing: AddressingMode, display: string): Instruction {
        return new Instruction(method, cycles, addressing, display);
    }

    private static LowNybble(value: number): number {
        return value & 0xf;
    }

    private static HighNybble(value: number): number {
        return MOS6502.DemoteNybble(value);
    }

    private static PromoteNybble(value: number): number {
        return value << 4;
    }

    private static DemoteNybble(value: number): number {
        return value >> 4;
    }

    private static LowByte(value: number): number {
        return value & 0xff;
    }

    private static HighByte(value: number): number {
        return (value & ~0xff) >> 8;
    }

    private static MakeWord(low: number, high: number): number {
        return (high << 8) + low;
    }

    public static get PageOne(): number { return 0x100; }

    public static get IRQvector(): number { return 0xfffe; }
    public static get RSTvector(): number { return 0xfffc; }
    public static get NMIvector(): number { return 0xfffa; }

    constructor(level: ProcessorType) {
        this._level = level;
        this.Install6502Instructions();
        this.Install65sc02Instructions();
        this.Install65c02Instructions();
    }

    public get Level(): ProcessorType { return this._level; }

    public get Proceed(): boolean { return this._proceed; }
    public set Proceed(value: boolean) { this._proceed = value; }

    public get Cycles(): number { return this._cycles; }
    public set Cycles(value: number) { this._cycles = value; }

    public get PC(): number { return this._pc; }
    public set PC(value: number) { this._pc = value; }

    public get Instructions(): Instruction[] { return this._instructions; }

    public get X(): number { return this._x; }
    public set X(value: number) { this._x = value; }

    public get Y(): number { return this._y; }
    public set Y(value: number) { this._y = value; }

    public get A(): number { return this._a; }
    public set A(value: number) { this._a = value; }

    public get S(): number { return this._s; }
    public set S(value: number) { this._s = value; }

    public get P(): StatusFlags { return this._p; }
    public set P(value: StatusFlags) { this._p = value; }

    public Initialise(): void {
        this.Cycles = 0;
        this.ResetRegisters();
    }

    public Start(address: number): void {
        this.PC = address;
    }

    public Run(): void {
        while (this.Proceed) {
            this.Step();
        }
    }

    public Step(): void {
        this.Execute(this.FetchByte());
    }

    public Reset(): void {
        this.PC = this.GetWord(MOS6502.RSTvector);
    }

    public TriggerIRQ(): void {
        this.Interrupt(MOS6502.IRQvector);
    }

    public TriggerNMI(): void {
        this.Interrupt(MOS6502.NMIvector);
    }

    public GetWord(offset: number): number {
        let low: number = this.GetByte(offset);
        let high: number = this.GetByte(offset + 1);
        return MOS6502.MakeWord(low, high);
    }

    public abstract GetByte(offset: number): number;

    public abstract SetByte(offset: number, value: number): void;

    protected Interrupt(vector: number): void {
        this.PushWord(this.PC);
        this.PushByte(this.P.toNumber());
        this.P.Interrupt = true;
        this.PC = this.GetWord(vector);
    }

    protected Execute(cell: number): void {
        let instruction: Instruction = this.Instructions[cell];
        let method: IImplementation = instruction.Vector;

        method.apply(this);

        this.Cycles += instruction.Count;
    }

    protected ___(): void {
        if (this.Level >= ProcessorType.Cpu65SC02) {
            // generally, missing instructions act as a one byte,
            // one cycle NOP instruction on 65c02 (ish) processors.
            this.NOP_imp();
            this.Cycles++;
        } else {
            throw new RangeError("Illegal instruction");
        }
    }

    protected ResetRegisters(): void {
        this.PC = 0;
        this.X = 0x80;
        this.Y = 0;
        this.A = 0;

        this.P = new StatusFlags(0);
        this.P.Reserved = true;

        this.S = 0xff;
    }

    ////

    private Install6502Instructions(): void {
        this._overlay6502 = [
            /* 0 */	MOS6502.INS(this.BRK_imp, 7, AddressingMode.Implied, "BRK"),
                        MOS6502.INS(this.ORA_xind, 6, AddressingMode.XIndexed, "ORA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.ORA_zp, 4, AddressingMode.ZeroPage, "ORA"),
                        MOS6502.INS(this.ASL_zp, 5, AddressingMode.ZeroPage, "ASL"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.PHP_imp, 3, AddressingMode.Implied, "PHP"),
                        MOS6502.INS(this.ORA_imm, 2, AddressingMode.Immediate, "ORA"),
                        MOS6502.INS(this.ASL_a, 2, AddressingMode.Accumulator, "ASL"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.ORA_abs, 4, AddressingMode.Absolute, "ORA"),
                        MOS6502.INS(this.ASL_abs, 6, AddressingMode.Absolute, "ASL"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* 1 */	MOS6502.INS(this.BPL_rel, 2, AddressingMode.Relative, "BPL"),
                        MOS6502.INS(this.ORA_indy, 5, AddressingMode.IndexedY, "ORA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.ORA_zpx, 4, AddressingMode.ZeroPageX, "ORA"),
                        MOS6502.INS(this.ASL_zpx, 6, AddressingMode.ZeroPageX, "ASL"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CLC_imp, 2, AddressingMode.Implied, "CLC"),
                        MOS6502.INS(this.ORA_absy, 4, AddressingMode.AbsoluteY, "ORA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.ORA_absx, 4, AddressingMode.AbsoluteX, "ORA"),
                        MOS6502.INS(this.ASL_absx, 7, AddressingMode.AbsoluteX, "ASL"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* 2 */	MOS6502.INS(this.JSR_abs, 6, AddressingMode.Absolute, "JSR"),
                        MOS6502.INS(this.AND_xind, 6, AddressingMode.XIndexed, "AND"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BIT_zp, 3, AddressingMode.ZeroPage, "BIT"),
                        MOS6502.INS(this.AND_zp, 3, AddressingMode.ZeroPage, "AND"),
                        MOS6502.INS(this.ROL_zp, 5, AddressingMode.ZeroPage, "ROL"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.PLP_imp, 4, AddressingMode.Implied, "PLP"),
                        MOS6502.INS(this.AND_imm, 2, AddressingMode.Immediate, "AND"),
                        MOS6502.INS(this.ROL_a, 2, AddressingMode.Accumulator, "ROL"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BIT_abs, 4, AddressingMode.Absolute, "BIT"),
                        MOS6502.INS(this.AND_abs, 4, AddressingMode.Absolute, "AND"),
                        MOS6502.INS(this.ROL_abs, 6, AddressingMode.Absolute, "ROL"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* 3 */	MOS6502.INS(this.BMI_rel, 2, AddressingMode.Relative, "BMI"),
                        MOS6502.INS(this.AND_indy, 5, AddressingMode.IndexedY, "AND"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.AND_zpx, 4, AddressingMode.ZeroPageX, "AND"),
                        MOS6502.INS(this.ROL_zpx, 6, AddressingMode.ZeroPageX, "ROL"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SEC_imp, 2, AddressingMode.Implied, "SEC"),
                        MOS6502.INS(this.AND_absy, 4, AddressingMode.AbsoluteY, "AND"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.AND_absx, 4, AddressingMode.AbsoluteX, "AND"),
                        MOS6502.INS(this.ROL_absx, 7, AddressingMode.AbsoluteX, "ROL"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* 4 */	MOS6502.INS(this.RTI_imp, 6, AddressingMode.Implied, "RTI"),
                        MOS6502.INS(this.EOR_xind, 6, AddressingMode.XIndexed, "EOR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.EOR_zp, 3, AddressingMode.ZeroPage, "EOR"),
                        MOS6502.INS(this.LSR_zp, 5, AddressingMode.ZeroPage, "LSR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.PHA_imp, 3, AddressingMode.Implied, "PHA"),
                        MOS6502.INS(this.EOR_imm, 2, AddressingMode.Immediate, "EOR"),
                        MOS6502.INS(this.LSR_a, 2, AddressingMode.Accumulator, "LSR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.JMP_abs, 3, AddressingMode.Absolute, "JMP"),
                        MOS6502.INS(this.EOR_abs, 4, AddressingMode.Absolute, "EOR"),
                        MOS6502.INS(this.LSR_abs, 6, AddressingMode.Absolute, "LSR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* 5 */	MOS6502.INS(this.BVC_rel, 2, AddressingMode.Relative, "BVC"),
                        MOS6502.INS(this.EOR_indy, 5, AddressingMode.IndexedY, "EOR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.EOR_zpx, 4, AddressingMode.ZeroPageX, "EOR"),
                        MOS6502.INS(this.LSR_zpx, 6, AddressingMode.ZeroPageX, "LSR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CLI_imp, 2, AddressingMode.Implied, "CLI"),
                        MOS6502.INS(this.EOR_absy, 4, AddressingMode.AbsoluteY, "EOR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.EOR_absx, 4, AddressingMode.AbsoluteX, "EOR"),
                        MOS6502.INS(this.LSR_absx, 7, AddressingMode.AbsoluteX, "LSR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* 6 */	MOS6502.INS(this.RTS_imp, 6, AddressingMode.Implied, "RTS"),
                        MOS6502.INS(this.ADC_xind, 6, AddressingMode.XIndexed, "ADC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.ADC_zp, 3, AddressingMode.ZeroPage, "ADC"),
                        MOS6502.INS(this.ROR_zp, 5, AddressingMode.ZeroPage, "ROR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.PLA_imp, 4, AddressingMode.Implied, "PLA"),
                        MOS6502.INS(this.ADC_imm, 2, AddressingMode.Immediate, "ADC"),
                        MOS6502.INS(this.ROR_a, 2, AddressingMode.Accumulator, "ROR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.JMP_ind, 5, AddressingMode.Indirect, "JMP"),
                        MOS6502.INS(this.ADC_abs, 4, AddressingMode.Absolute, "ADC"),
                        MOS6502.INS(this.ROR_abs, 6, AddressingMode.Absolute, "ROR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* 7 */	MOS6502.INS(this.BVS_rel, 2, AddressingMode.Relative, "BVS"),
                        MOS6502.INS(this.ADC_indy, 5, AddressingMode.IndexedY, "ADC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.ADC_zpx, 4, AddressingMode.ZeroPageX, "ADC"),
                        MOS6502.INS(this.ROR_zpx, 6, AddressingMode.ZeroPageX, "ROR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SEI_imp, 2, AddressingMode.Implied, "SEI"),
                        MOS6502.INS(this.ADC_absy, 4, AddressingMode.AbsoluteY, "ADC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.ADC_absx, 4, AddressingMode.AbsoluteX, "ADC"),
                        MOS6502.INS(this.ROR_absx, 7, AddressingMode.AbsoluteX, "ROR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* 8 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STA_xind, 6, AddressingMode.XIndexed, "STA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STY_zp, 3, AddressingMode.ZeroPage, "STY"),
                        MOS6502.INS(this.STA_zp, 3, AddressingMode.ZeroPage, "STA"),
                        MOS6502.INS(this.STX_zp, 3, AddressingMode.ZeroPage, "STX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.DEY_imp, 2, AddressingMode.Implied, "DEY"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.TXA_imp, 2, AddressingMode.Implied, "TXA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STY_abs, 4, AddressingMode.Absolute, "STY"),
                        MOS6502.INS(this.STA_abs, 4, AddressingMode.Absolute, "STA"),
                        MOS6502.INS(this.STX_abs, 4, AddressingMode.Absolute, "STX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* 9 */	MOS6502.INS(this.BCC_rel, 2, AddressingMode.Relative, "BCC"),
                        MOS6502.INS(this.STA_indy, 6, AddressingMode.IndexedY, "STA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STY_zpx, 4, AddressingMode.ZeroPageX, "STY"),
                        MOS6502.INS(this.STA_zpx, 4, AddressingMode.ZeroPageX, "STA"),
                        MOS6502.INS(this.STX_zpy, 4, AddressingMode.ZeroPageY, "STX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.TYA_imp, 2, AddressingMode.Implied, "TYA"),
                        MOS6502.INS(this.STA_absy, 5, AddressingMode.AbsoluteY, "STA"),
                        MOS6502.INS(this.TXS_imp, 2, AddressingMode.Implied, "TXS"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STA_absx, 5, AddressingMode.AbsoluteX, "STA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* A */	MOS6502.INS(this.LDY_imm, 2, AddressingMode.Immediate, "LDY"),
                        MOS6502.INS(this.LDA_xind, 6, AddressingMode.XIndexed, "LDA"),
                        MOS6502.INS(this.LDX_imm, 2, AddressingMode.Immediate, "LDX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.LDY_zp, 3, AddressingMode.ZeroPage, "LDY"),
                        MOS6502.INS(this.LDA_zp, 3, AddressingMode.ZeroPage, "LDA"),
                        MOS6502.INS(this.LDX_zp, 3, AddressingMode.ZeroPage, "LDX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.TAY_imp, 2, AddressingMode.Implied, "TAY"),
                        MOS6502.INS(this.LDA_imm, 2, AddressingMode.Immediate, "LDA"),
                        MOS6502.INS(this.TAX_imp, 2, AddressingMode.Implied, "TAX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.LDY_abs, 4, AddressingMode.Absolute, "LDY"),
                        MOS6502.INS(this.LDA_abs, 4, AddressingMode.Absolute, "LDA"),
                        MOS6502.INS(this.LDX_abs, 4, AddressingMode.Absolute, "LDX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* B */	MOS6502.INS(this.BCS_rel, 2, AddressingMode.Relative, "BCS"),
                        MOS6502.INS(this.LDA_indy, 5, AddressingMode.IndexedY, "LDA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.LDY_zpx, 4, AddressingMode.ZeroPageX, "LDY"),
                        MOS6502.INS(this.LDA_zpx, 4, AddressingMode.ZeroPageX, "LDA"),
                        MOS6502.INS(this.LDX_zpy, 4, AddressingMode.ZeroPageY, "LDX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CLV_imp, 2, AddressingMode.Implied, "CLV"),
                        MOS6502.INS(this.LDA_absy, 4, AddressingMode.AbsoluteY, "LDA"),
                        MOS6502.INS(this.TSX_imp, 2, AddressingMode.Implied, "TSX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.LDY_absx, 4, AddressingMode.AbsoluteX, "LDY"),
                        MOS6502.INS(this.LDA_absx, 4, AddressingMode.AbsoluteX, "LDA"),
                        MOS6502.INS(this.LDX_absy, 4, AddressingMode.AbsoluteY, "LDX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* C */	MOS6502.INS(this.CPY_imm, 2, AddressingMode.Immediate, "CPY"),
                        MOS6502.INS(this.CMP_xind, 6, AddressingMode.XIndexed, "CMP"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CPY_zp, 3, AddressingMode.ZeroPage, "CPY"),
                        MOS6502.INS(this.CMP_zp, 3, AddressingMode.ZeroPage, "CMP"),
                        MOS6502.INS(this.DEC_zp, 5, AddressingMode.ZeroPage, "DEC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.INY_imp, 2, AddressingMode.Implied, "INY"),
                        MOS6502.INS(this.CMP_imm, 2, AddressingMode.Immediate, "CMP"),
                        MOS6502.INS(this.DEX_imp, 2, AddressingMode.Implied, "DEX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CPY_abs, 4, AddressingMode.Absolute, "CPY"),
                        MOS6502.INS(this.CMP_abs, 4, AddressingMode.Absolute, "CMP"),
                        MOS6502.INS(this.DEC_abs, 6, AddressingMode.Absolute, "DEC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* D */	MOS6502.INS(this.BNE_rel, 2, AddressingMode.Relative, "BNE"),
                        MOS6502.INS(this.CMP_indy, 5, AddressingMode.IndexedY, "CMP"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CMP_zpx, 4, AddressingMode.ZeroPageX, "CMP"),
                        MOS6502.INS(this.DEC_zpx, 6, AddressingMode.ZeroPageX, "DEC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CLD_imp, 2, AddressingMode.Implied, "CLD"),
                        MOS6502.INS(this.CMP_absy, 4, AddressingMode.AbsoluteY, "CMP"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CMP_absx, 4, AddressingMode.AbsoluteX, "CMP"),
                        MOS6502.INS(this.DEC_absx, 7, AddressingMode.AbsoluteX, "DEC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* E */	MOS6502.INS(this.CPX_imm, 2, AddressingMode.Immediate, "CPX"),
                        MOS6502.INS(this.SBC_xind, 6, AddressingMode.XIndexed, "SBC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CPX_zp, 3, AddressingMode.ZeroPage, "CPX"),
                        MOS6502.INS(this.SBC_zp, 3, AddressingMode.ZeroPage, "SBC"),
                        MOS6502.INS(this.INC_zp, 5, AddressingMode.ZeroPage, "INC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.INX_imp, 2, AddressingMode.Implied, "INX"),
                        MOS6502.INS(this.SBC_imm, 2, AddressingMode.Immediate, "SBC"),
                        MOS6502.INS(this.NOP_imp, 2, AddressingMode.Implied, "NOP"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CPX_abs, 4, AddressingMode.Absolute, "CPX"),
                        MOS6502.INS(this.SBC_abs, 4, AddressingMode.Absolute, "SBC"),
                        MOS6502.INS(this.INC_abs, 6, AddressingMode.Absolute, "INC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
            /* F */	MOS6502.INS(this.BEQ_rel, 2, AddressingMode.Relative, "BEQ"),
                        MOS6502.INS(this.SBC_indy, 5, AddressingMode.IndexedY, "SBC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SBC_zpx, 4, AddressingMode.ZeroPageX, "SBC"),
                        MOS6502.INS(this.INC_zpx, 6, AddressingMode.ZeroPageX, "INC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SED_imp, 2, AddressingMode.Implied, "SED"),
                        MOS6502.INS(this.SBC_absy, 4, AddressingMode.AbsoluteY, "SBC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SBC_absx, 4, AddressingMode.AbsoluteX, "SBC"),
                        MOS6502.INS(this.INC_absx, 7, AddressingMode.AbsoluteX, "INC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
        ];
        this.InstallInstructionSet(this._overlay6502);
    }

    private Install65sc02Instructions(): void {
        if (this._level >= ProcessorType.Cpu65SC02) {
            this._overlay65sc02 = [
            /* 0 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 2, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.TSB_zp, 5, AddressingMode.ZeroPage, "TSB"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.TSB_abs, 6, AddressingMode.Absolute, "TSB"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* 1 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.ORA_zpind, 5, AddressingMode.ZeroPageIndirect, "ORA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.TRB_zp, 5, AddressingMode.ZeroPage, "TRB"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.INC_a, 2, AddressingMode.Accumulator, "INC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.TRB_abs, 6, AddressingMode.Absolute, "TRB"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* 2 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 2, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* 3 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.AND_zpind, 5, AddressingMode.ZeroPageIndirect, "AND"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BIT_zpx, 4, AddressingMode.ZeroPageX, "BIT"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.DEC_a, 2, AddressingMode.Accumulator, "DEC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BIT_absx, 4, AddressingMode.AbsoluteX, "BIT"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* 4 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 2, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 3, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* 5 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.EOR_zpind, 5, AddressingMode.ZeroPageIndirect, "EOR"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 4, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.PHY_imp, 2, AddressingMode.Implied, "PHY"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP3_imp, 8, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* 6 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 2, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STZ_zp, 3, AddressingMode.ZeroPage, "STZ"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* 7 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.ADC_zpind, 5, AddressingMode.ZeroPageIndirect, "ADC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STZ_zpx, 4, AddressingMode.ZeroPageX, "STZ"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.PLY_imp, 2, AddressingMode.Implied, "PLY"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.JMP_absxind, 6, AddressingMode.AbsoluteXIndirect, "JMP"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* 8 */	MOS6502.INS(this.BRA_rel, 2, AddressingMode.Relative, "BRA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 2, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BIT_imm, 2, AddressingMode.Immediate, "BIT"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* 9 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STA_zpind, 5, AddressingMode.ZeroPageIndirect, "STA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STZ_abs, 4, AddressingMode.Absolute, "STZ"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STZ_absx, 2, AddressingMode.AbsoluteX, "STZ"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* A */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* B */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.LDA_zpind, 5, AddressingMode.ZeroPageIndirect, "LDA"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* C */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 2, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* D */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.CMP_zpind, 5, AddressingMode.ZeroPageIndirect, "CMP"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 4, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.PHX_imp, 2, AddressingMode.Implied, "PHX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP3_imp, 4, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* E */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 2, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            /* F */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SBC_zpind, 5, AddressingMode.ZeroPageIndirect, "SBC"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP2_imp, 4, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.PLX_imp, 2, AddressingMode.Implied, "PLX"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.NOP3_imp, 4, AddressingMode.Implied, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
            ];
            this.OverlayInstructionSet(this._overlay65sc02);
        }
    }

    private Install65c02Instructions(): void {
        if (this.Level >= ProcessorType.Cpu65C02) {
            this._overlay65c02 = [
                /* 0 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.RMB0_zp, 5, AddressingMode.ZeroPage, "RMB0"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBR0_zprel, 5, AddressingMode.ZeroPageRelative, "BBR0"),
                /* 1 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.RMB1_zp, 5, AddressingMode.ZeroPage, "RMB1"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBR1_zprel, 5, AddressingMode.ZeroPageRelative, "BBR1"),
                /* 2 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.RMB2_zp, 5, AddressingMode.ZeroPage, "RMB2"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBR2_zprel, 5, AddressingMode.ZeroPageRelative, "BBR2"),
                /* 3 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.RMB3_zp, 5, AddressingMode.ZeroPage, "RMB3"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBR3_zprel, 5, AddressingMode.ZeroPageRelative, "BBR3"),
                /* 4 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.RMB4_zp, 5, AddressingMode.ZeroPage, "RMB4"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBR4_zprel, 5, AddressingMode.ZeroPageRelative, "BBR4"),
                /* 5 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.RMB5_zp, 5, AddressingMode.ZeroPage, "RMB5"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBR5_zprel, 5, AddressingMode.ZeroPageRelative, "BBR5"),
                /* 6 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.RMB6_zp, 5, AddressingMode.ZeroPage, "RMB6"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBR6_zprel, 5, AddressingMode.ZeroPageRelative, "BBR6"),
                /* 7 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.RMB7_zp, 5, AddressingMode.ZeroPage, "RMB7"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBR7_zprel, 5, AddressingMode.ZeroPageRelative, "BBR7"),
                /* 8 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SMB0_zp, 5, AddressingMode.ZeroPage, "SMB0"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBS0_zprel, 5, AddressingMode.ZeroPageRelative, "BBS0"),
                /* 9 */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SMB1_zp, 5, AddressingMode.ZeroPage, "SMB1"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBS1_zprel, 5, AddressingMode.ZeroPageRelative, "BBS1"),
                /* A */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SMB2_zp, 5, AddressingMode.ZeroPage, "SMB2"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBS2_zprel, 5, AddressingMode.ZeroPageRelative, "BBS2"),
                /* B */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SMB3_zp, 5, AddressingMode.ZeroPage, "SMB3"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBS3_zprel, 5, AddressingMode.ZeroPageRelative, "BBS3"),
                /* C */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SMB4_zp, 5, AddressingMode.ZeroPage, "SMB4"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.WAI_imp, 3, AddressingMode.Implied, "WAI"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBS4_zprel, 5, AddressingMode.ZeroPageRelative, "BBS4"),
                /* D */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SMB5_zp, 5, AddressingMode.ZeroPage, "SMB5"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.STP_imp, 3, AddressingMode.Implied, "STP"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBS5_zprel, 5, AddressingMode.ZeroPageRelative, "BBS5"),
                /* E */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SMB6_zp, 5, AddressingMode.ZeroPage, "SMB6"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBS6_zprel, 5, AddressingMode.ZeroPageRelative, "BBS6"),
                /* F */	MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.SMB7_zp, 5, AddressingMode.ZeroPage, "SMB7"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 0, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.___, 2, AddressingMode.Illegal, "___"),
                        MOS6502.INS(this.BBS7_zprel, 5, AddressingMode.ZeroPageRelative, "BBS7"),
            ];
            this.OverlayInstructionSet(this._overlay65c02);
        }
    }

    private InstallInstructionSet(basis: Instruction[]): void {
        this._instructions = basis;
    }

    private OverlayInstructionSet(overlay: Instruction[], includeIllegal?: boolean): void {
        if (includeIllegal === undefined) {
            includeIllegal = false;
        }
        for (let i: number = 0; i < 0x100; ++i) {
            let newInstruction: Instruction = overlay[i];
            let illegal: boolean = newInstruction.Mode === AddressingMode.Illegal;
            if (includeIllegal || !illegal) {
                let oldInstruction: Instruction = this.Instructions[i];
                if (oldInstruction.Mode !== AddressingMode.Illegal) {
                    throw new RangeError ("Whoops: replacing a non-missing instruction.");
                }
                this.Instructions[i] = newInstruction;
            }
        }
    }

    ////

    private UpdateZeroFlag(datum: number): boolean {
        return this.P.Zero = datum === 0;
    }

    private UpdateNegativeFlag(datum: number): boolean {
        return this.P.Negative = datum < 0;
    }

    private UpdateZeroNegativeFlags(datum: number): void {
        if (this.UpdateZeroFlag(datum)) {
            this.P.Negative = false;
        } else {
            this.UpdateNegativeFlag(MOS6502.toSignedByte(datum));
        }
    }

    ////

    private PushByte(value: number): void {
        this.SetByte(MOS6502.PageOne + this.S--, value);
    }

    private PopByte(): number {
        return this.GetByte(MOS6502.PageOne + ++this.S);
    }

    private PushWord(value: number): void {
        this.PushByte(MOS6502.HighByte(value));
        this.PushByte(MOS6502.LowByte(value));
    }

    private PopWord(): number {
        let low: number = this.PopByte();
        let high: number = this.PopByte();
        return MOS6502.MakeWord(low, high);
    }

    private FetchByte(): number {
        return this.GetByte(this.PC++);
    }

    private FetchWord(): number {
        let word: number = this.GetWord(this.PC);
        this.PC += 2;
        return word;
    }

    ////

    private Address_ZeroPage(): number {
        return this.FetchByte();
    }

    private Address_ZeroPageX(): number {
        return MOS6502.LowByte(this.FetchByte() + this.X);
    }

    private Address_ZeroPageY(): number {
        return MOS6502.LowByte(this.FetchByte() + this.Y);
    }

    private Address_IndexedIndirectX(): number {
        return this.GetWord(this.Address_ZeroPageX());
    }

    private Address_IndexedIndirectY_Read(): number {
        let indirection: number = this.GetWord(this.FetchByte());
        if (MOS6502.LowByte(indirection) === 0xff) {
            ++this.Cycles;
        }
        return indirection + this.Y;
    }

    private Address_IndexedIndirectY_Write(): number {
        return this.GetWord(this.FetchByte()) + this.Y;
    }

    private Address_Absolute(): number {
        return this.FetchWord();
    }

    private Address_AbsoluteXIndirect(): number {
        return this.GetWord(this.FetchWord() + this.X);
    }

    private Address_AbsoluteX_Read(): number {
        let address:  number = this.FetchWord();
        let offset: number = address + this.X;
        if (MOS6502.LowByte(offset) === 0xff) {
            ++this.Cycles;
        }
        return offset;
    }

    private Address_AbsoluteX_Write(): number {
        return this.FetchWord() + this.X;
    }

    private Address_AbsoluteY_Read(): number {
        let address: number = this.FetchWord();
        let offset: number = address + this.Y;
        if (MOS6502.LowByte(offset) === 0xff) {
            ++this.Cycles;
        }
        return offset;
    }

    private Address_AbsoluteY_Write(): number {
        return this.FetchWord() + this.Y;
    }

    private Address_ZeroPageIndirect(): number {
        return this.GetWord(this.FetchByte());
    }

    ////

    private ReadByte_Immediate(): number {
        return this.FetchByte();
    }

    private ReadByte_ImmediateDisplacement(): number {
        return MOS6502.toSignedByte(this.FetchByte());
    }

    private ReadByte_ZeroPage(): number {
        return this.GetByte(this.Address_ZeroPage());
    }

    private ReadByte_ZeroPageX(): number {
        return this.GetByte(this.Address_ZeroPageX());
    }

    private ReadByte_ZeroPageY(): number {
        return this.GetByte(this.Address_ZeroPageY());
    }

    private ReadByte_Absolute(): number {
        return this.GetByte(this.Address_Absolute());
    }

    private ReadByte_AbsoluteX(): number {
        return this.GetByte(this.Address_AbsoluteX_Read());
    }

    private ReadByte_AbsoluteY(): number {
        return this.GetByte(this.Address_AbsoluteY_Read());
    }

    private ReadByte_IndexedIndirectX(): number {
        return this.GetByte(this.Address_IndexedIndirectX());
    }

    private ReadByte_IndirectIndexedY(): number {
        return this.GetByte(this.Address_IndexedIndirectY_Read());
    }

    private ReadByte_ZeroPageIndirect(): number {
        return this.GetByte(this.Address_ZeroPageIndirect());
    }

    ////

    private WriteByte_ZeroPage(value: number): void {
        this.SetByte(this.Address_ZeroPage(), value);
    }

    private WriteByte_Absolute(value: number): void {
        this.SetByte(this.Address_Absolute(), value);
    }

    private WriteByte_AbsoluteX(value: number): void {
        this.SetByte(this.Address_AbsoluteX_Write(), value);
    }

    private WriteByte_AbsoluteY(value: number): void {
        this.SetByte(this.Address_AbsoluteY_Write(), value);
    }

    private WriteByte_ZeroPageX(value: number): void {
        this.SetByte(this.Address_ZeroPageX(), value);
    }

    private WriteByte_ZeroPageY(value: number): void {
        this.SetByte(this.Address_ZeroPageY(), value);
    }

    private WriteByte_IndirectIndexedY(value: number): void {
        this.SetByte(this.Address_IndexedIndirectY_Write(), value);
    }

    private WriteByte_IndexedIndirectX(value: number): void {
        this.SetByte(this.Address_IndexedIndirectX(), value);
    }

    private WriteByte_ZeroPageIndirect(value: number): void {
        this.SetByte(this.Address_ZeroPageIndirect(), value);
    }

    ////

    private DEC(offset: number): void {
        let content: number = this.GetByte(offset);
        this.SetByte(offset, --content);
        this.UpdateZeroNegativeFlags(content);
    }

    private ROR_data(data: number): number {
        let carry: boolean = this.P.Carry;

        this.P.Carry = (data & 1) !== 0;

        let result: number = data >> 1;
        if (carry) {
            result |= 0x80;
        }

        this.UpdateZeroNegativeFlags(result);

        return result;
    }

    private ROR_contents(offset: number): void {
        this.SetByte(offset, this.ROR_data(this.GetByte(offset)));
    }

    private LSR_data(data: number): number {
        this.P.Carry = (data & 1) !== 0;

        let result: number = data >> 1;

        this.UpdateZeroNegativeFlags(result);

        return result;
    }

    private LSR_contents(offset: number): void {
        this.SetByte(offset, this.LSR_data(this.GetByte(offset)));
    }

    private BIT_immediate(data: number): void {
        let result: number = this.A & data;
        this.UpdateZeroFlag(result);
    }

    private BIT(data: number): void {
        this.BIT_immediate(data);
        this.P.Negative = (data & 0x80) !== 0;
        this.P.Overflow = (data & 0x40) !== 0;
    }

    private TSB(address: number): void {
        let content: number = this.GetByte(address);
        this.BIT_immediate(content);

        let result: number = content | this.A;
        this.SetByte(address, result);
    }

    private TRB(address: number): void {
        let content: number = this.GetByte(address);
        this.BIT_immediate(content);

        let result: number = content & ~this.A;
        this.SetByte(address, result);
    }

    private INC(offset: number): void {
        let content: number = this.GetByte(offset);
        this.SetByte(offset, ++content);
        this.UpdateZeroNegativeFlags(content);
    }

    private ROL_contents(offset: number): void {
        this.SetByte(offset, this.ROL_data(this.GetByte(offset)));
    }

    private ROL_data(data: number): number {
        let carry: boolean = this.P.Carry;

        this.P.Carry = (data & 0x80) !== 0;

        let result: number = data << 1;

        if (carry) {
            result |= 1;
        }

        this.UpdateZeroNegativeFlags(result);

        return result;
    }

    private ASL_contents(offset: number): void {
        this.SetByte(offset, this.ASL_data(this.GetByte(offset)));
    }

    private ASL_data(data: number): number {
        let result: number = data << 1;

        this.UpdateZeroNegativeFlags(result);
        this.P.Carry = (data & 0x80) !== 0;

        return result;
    }

    private ORA(data: number): void {
        this.A |= data;
        this.UpdateZeroNegativeFlags(this.A);
    }

    private AND(data: number): void {
        this.A &= data;
        this.UpdateZeroNegativeFlags(this.A);
    }

    private SBC(data: number): void {
        if (this.P.Decimal) {
            this.SBC_d(data);
        } else {
            this.SBC_b(data);
        }
    }

    private SBC_b(data: number): void {
        let carry: number = this.P.Carry ? 0 : 1;
        let difference: number = this.A - data - carry;

        this.UpdateZeroNegativeFlags(difference);
        this.P.Overflow = ((this.A ^ data) & (this.A ^ difference) & 0x80) !== 0;
        this.P.Carry = MOS6502.HighByte(difference) === 0;

        this.A = difference;
    }

    private SBC_d(data: number): void {
        let carry: number = this.P.Carry ? 0 : 1;
        let difference: number = this.A - data - carry;

        if (this.Level < ProcessorType.Cpu65SC02) {
            this.UpdateZeroNegativeFlags(difference);
        }

        this.P.Overflow = ((this.A ^ data) & (this.A ^ difference) & 0x80) !== 0;
        this.P.Carry = MOS6502.HighByte(difference) === 0;

        let low: number = MOS6502.LowNybble(this.A) - MOS6502.LowNybble(data) - carry;

        let lowNegative: boolean = MOS6502.toSignedByte(low) < 0;
        if (lowNegative) {
            low -= 6;
        }

        let high: number = MOS6502.HighNybble(this.A) - MOS6502.HighNybble(data) - (lowNegative ? 1 : 0);

        if (MOS6502.toSignedByte(high) < 0) {
            high -= 6;
        }

        this.A = MOS6502.PromoteNybble(high) | MOS6502.LowNybble(low);
        if (this.Level >= ProcessorType.Cpu65SC02) {
            this.UpdateZeroNegativeFlags(this.A);
        }
    }

    private EOR(data: number): void {
        this.A ^= data;
        this.UpdateZeroNegativeFlags(this.A);
    }

    private CPX(data: number): void {
        this.CMP(this.X, data);
    }

    private CPY(data: number): void {
        this.CMP(this.Y, data);
    }

    private CMP_acc(data: number): void {
        this.CMP(this.A, data);
    }

    private CMP(first: number, second: number): void {
        let result: number = first - second;

        this.UpdateZeroNegativeFlags(MOS6502.toUnsignedByte(result));
        this.P.Carry = MOS6502.HighByte(result) === 0;
    }

    private LDA(data: number): void {
        this.A = data;
        this.UpdateZeroNegativeFlags(this.A);
    }

    private LDY(data: number): void {
        this.Y = data;
        this.UpdateZeroNegativeFlags(this.Y);
    }

    private LDX(data: number): void {
        this.X = data;
        this.UpdateZeroNegativeFlags(this.X);
    }

    private ADC(data: number): void {
        if (this.P.Decimal) {
            this.ADC_d(data);
        } else {
            this.ADC_b(data);
        }
    }

    private ADC_b(data: number): void {
        let carry: number = this.P.Carry ? 1 : 0;
        let sum: number = this.A + data + carry;

        this.UpdateZeroNegativeFlags(sum);
        this.P.Overflow = (~(this.A ^ data) & (this.A ^ sum) & 0x80) !== 0;
        this.P.Carry = MOS6502.HighByte(sum) !== 0;

        this.A = sum;
    }

    private ADC_d(data: number): void {
        let carry: number = this.P.Carry ? 1 : 0;
        let sum: number = this.A + data + carry;

        if (this.Level < ProcessorType.Cpu65SC02) {
            this.UpdateZeroNegativeFlags(sum);
        }

        let low: number = MOS6502.LowNybble(this.A) + MOS6502.LowNybble(data) + carry;
        if (low > 9) {
            low += 6;
        }

        let high: number = MOS6502.HighNybble(this.A) + MOS6502.HighNybble(data) + (low > 0xf ? 1 : 0);
        this.P.Overflow = (~(this.A ^ data) & (this.A ^ MOS6502.PromoteNybble(high)) & 0x80) !== 0;

        if (high > 9) {
            high += 6;
        }

        this.P.Carry = high > 0xf;

        this.A = MOS6502.PromoteNybble(high) | MOS6502.LowNybble(low);
        if (this.Level >= ProcessorType.Cpu65SC02) {
            this.UpdateZeroNegativeFlags(this.A);
        }
    }

    ////

    private RMB(address: number, flag: number): void {
        let data: number = this.GetByte(address);
        data &= ~flag;
        this.SetByte(address, data);
    }

    private SMB(address: number, flag: number): void {
        let data: number = this.GetByte(address);
        data |= flag;
        this.SetByte(address, data);
    }

    ////

    private BranchOffset(displacement: number): void {
        console.assert((displacement >= -128) && (displacement <= 127));
        ++this.Cycles;
        let oldPage: number = MOS6502.HighByte(this.PC);
        this.PC += displacement;
        let newPage: number = MOS6502.HighByte(this.PC);
        if (oldPage !== newPage) {
            this.Cycles += 2;
        }
    }

    private Branch(): void {
        let displacement: number = this.ReadByte_ImmediateDisplacement();
        this.BranchOffset(displacement);
    }

    private BranchConditionally(flag: boolean): void {
        let displacement: number = this.ReadByte_ImmediateDisplacement();
        if (flag) {
            this.BranchOffset(displacement);
        }
    }

    private BitBranch_Clear(check: number): void {
        let zp: number = this.FetchByte();
        let contents: number = this.GetByte(zp);
        let displacement: number = this.FetchByte();
        if ((contents & check) === 0) {
            this.PC += displacement;
        }
    }

    private BitBranch_Set(check: number): void {
        let zp: number = this.FetchByte();
        let contents: number = this.GetByte(zp);
        let displacement: number = this.FetchByte();
        if ((contents & check) !== 0) {
            this.PC += displacement;
        }
    }

    // instruction implementations

    private NOP_imp(): void {}

    private NOP2_imp(): void {
        this.FetchByte();
    }

    private NOP3_imp(): void {
        this.FetchWord();
    }

    // readers

    // ora

    private ORA_xind(): void {
        this.ORA(this.ReadByte_IndexedIndirectX());
    }

    private ORA_zp(): void {
        this.ORA(this.ReadByte_ZeroPage());
    }

    private ORA_imm(): void {
        this.ORA(this.ReadByte_Immediate());
    }

    private ORA_abs(): void {
        this.ORA(this.ReadByte_Absolute());
    }

    private ORA_absx(): void {
        this.ORA(this.ReadByte_AbsoluteX());
    }

    private ORA_absy(): void {
        this.ORA(this.ReadByte_AbsoluteY());
    }

    private ORA_zpx(): void {
        this.ORA(this.ReadByte_ZeroPageX());
    }

    private ORA_indy(): void {
        this.ORA(this.ReadByte_IndirectIndexedY());
    }

    private ORA_zpind(): void {
        this.ORA(this.ReadByte_ZeroPageIndirect());
    }

    // and

    private AND_zpx(): void {
        this.AND(this.ReadByte_ZeroPageX());
    }

    private AND_indy(): void {
        this.AND(this.ReadByte_IndirectIndexedY());
    }

    private AND_zp(): void {
        this.AND(this.ReadByte_ZeroPage());
    }

    private AND_absx(): void {
        this.AND(this.ReadByte_AbsoluteX());
    }

    private AND_absy(): void {
        this.AND(this.ReadByte_AbsoluteY());
    }

    private AND_imm(): void {
        this.AND(this.ReadByte_Immediate());
    }

    private AND_xind(): void {
        this.AND(this.ReadByte_IndexedIndirectX());
    }

    private AND_abs(): void {
        this.AND(this.ReadByte_Absolute());
    }

    private AND_zpind(): void {
        this.AND(this.ReadByte_ZeroPageIndirect());
    }

    // eor

    private EOR_absx(): void {
        this.EOR(this.ReadByte_AbsoluteX());
    }

    private EOR_absy(): void {
        this.EOR(this.ReadByte_AbsoluteY());
    }

    private EOR_zpx(): void {
        this.EOR(this.ReadByte_ZeroPageX());
    }

    private EOR_indy(): void {
        this.EOR(this.ReadByte_IndirectIndexedY());
    }

    private EOR_abs(): void {
        this.EOR(this.ReadByte_Absolute());
    }

    private EOR_imm(): void {
        this.EOR(this.ReadByte_Immediate());
    }

    private EOR_zp(): void {
        this.EOR(this.ReadByte_ZeroPage());
    }

    private EOR_xind(): void {
        this.EOR(this.ReadByte_IndexedIndirectX());
    }

    private EOR_zpind(): void {
        this.EOR(this.ReadByte_ZeroPageIndirect());
    }

    // lda

    private LDA_absx(): void {
        this.LDA(this.ReadByte_AbsoluteX());
    }

    private LDA_absy(): void {
        this.LDA(this.ReadByte_AbsoluteY());
    }

    private LDA_zpx(): void {
        this.LDA(this.ReadByte_ZeroPageX());
    }

    private LDA_indy(): void {
        this.LDA(this.ReadByte_IndirectIndexedY());
    }

    private LDA_abs(): void {
        this.LDA(this.ReadByte_Absolute());
    }

    private LDA_imm(): void {
        this.LDA(this.ReadByte_Immediate());
    }

    private LDA_zp(): void {
        this.LDA(this.ReadByte_ZeroPage());
    }

    private LDA_xind(): void {
        this.LDA(this.ReadByte_IndexedIndirectX());
    }

    private LDA_zpind(): void {
        this.LDA(this.ReadByte_ZeroPageIndirect());
    }

    // ldx

    private LDX_imm(): void {
        this.LDX(this.ReadByte_Immediate());
    }

    private LDX_zp(): void {
        this.LDX(this.ReadByte_ZeroPage());
    }

    private LDX_abs(): void {
        this.LDX(this.ReadByte_Absolute());
    }

    private LDX_zpy(): void {
        this.LDX(this.ReadByte_ZeroPageY());
    }

    private LDX_absy(): void {
        this.LDX(this.ReadByte_AbsoluteY());
    }

    // ldy

    private LDY_imm(): void {
        this.LDY(this.ReadByte_Immediate());
    }

    private LDY_zp(): void {
        this.LDY(this.ReadByte_ZeroPage());
    }

    private LDY_abs(): void {
        this.LDY(this.ReadByte_Absolute());
    }

    private LDY_zpx(): void {
        this.LDY(this.ReadByte_ZeroPageX());
    }

    private LDY_absx(): void {
        this.LDY(this.ReadByte_AbsoluteX());
    }

    // cmp

    private CMP_absx(): void {
        this.CMP_acc(this.ReadByte_AbsoluteX());
    }

    private CMP_absy(): void {
        this.CMP_acc(this.ReadByte_AbsoluteY());
    }

    private CMP_zpx(): void {
        this.CMP_acc(this.ReadByte_ZeroPageX());
    }

    private CMP_indy(): void {
        this.CMP_acc(this.ReadByte_IndirectIndexedY());
    }

    private CMP_abs(): void {
        this.CMP_acc(this.ReadByte_Absolute());
    }

    private CMP_imm(): void {
        this.CMP_acc(this.ReadByte_Immediate());
    }

    private CMP_zp(): void {
        this.CMP_acc(this.ReadByte_ZeroPage());
    }

    private CMP_xind(): void {
        this.CMP_acc(this.ReadByte_IndexedIndirectX());
    }

    private CMP_zpind(): void {
        this.CMP_acc(this.ReadByte_ZeroPageIndirect());
    }

    // cpx

    private CPX_abs(): void {
        this.CPX(this.ReadByte_Absolute());
    }

    private CPX_zp(): void {
        this.CPX(this.ReadByte_ZeroPage());
    }

    private CPX_imm(): void {
        this.CPX(this.ReadByte_Immediate());
    }

    // cpy

    private CPY_imm(): void {
        this.CPY(this.ReadByte_Immediate());
    }

    private CPY_zp(): void {
        this.CPY(this.ReadByte_ZeroPage());
    }

    private CPY_abs(): void {
        this.CPY(this.ReadByte_Absolute());
    }

    // adc

    private ADC_zp(): void {
        this.ADC(this.ReadByte_ZeroPage());
    }

    private ADC_xind(): void {
        this.ADC(this.ReadByte_IndexedIndirectX());
    }

    private ADC_imm(): void {
        this.ADC(this.ReadByte_Immediate());
    }

    private ADC_abs(): void {
        this.ADC(this.ReadByte_Absolute());
    }

    private ADC_zpx(): void {
        this.ADC(this.ReadByte_ZeroPageX());
    }

    private ADC_indy(): void {
        this.ADC(this.ReadByte_IndirectIndexedY());
    }

    private ADC_absx(): void {
        this.ADC(this.ReadByte_AbsoluteX());
    }

    private ADC_absy(): void {
        this.ADC(this.ReadByte_AbsoluteY());
    }

    private ADC_zpind(): void {
        this.ADC(this.ReadByte_ZeroPageIndirect());
    }

    // sbc

    private SBC_xind(): void {
        this.SBC(this.ReadByte_IndexedIndirectX());
    }

    private SBC_zp(): void {
        this.SBC(this.ReadByte_ZeroPage());
    }

    private SBC_imm(): void {
        this.SBC(this.ReadByte_Immediate());
    }

    private SBC_abs(): void {
        this.SBC(this.ReadByte_Absolute());
    }

    private SBC_zpx(): void {
        this.SBC(this.ReadByte_ZeroPageX());
    }

    private SBC_indy(): void {
        this.SBC(this.ReadByte_IndirectIndexedY());
    }

    private SBC_absx(): void {
        this.SBC(this.ReadByte_AbsoluteX());
    }

    private SBC_absy(): void {
        this.SBC(this.ReadByte_AbsoluteY());
    }

    private SBC_zpind(): void {
        this.SBC(this.ReadByte_ZeroPageIndirect());
    }

    // bit

    private BIT_imm(): void {
        this.BIT_immediate(this.ReadByte_Immediate());
    }

    private BIT_zp(): void {
        this.BIT(this.ReadByte_ZeroPage());
    }

    private BIT_zpx(): void {
        this.BIT(this.ReadByte_ZeroPageX());
    }

    private BIT_abs(): void {
        this.BIT(this.ReadByte_Absolute());
    }

    private BIT_absx(): void {
        this.BIT(this.ReadByte_AbsoluteX());
    }

    // increment and decrement

    // dec

    private DEC_a(): void {
        this.UpdateZeroNegativeFlags(--this.A);
    }

    private DEC_absx(): void {
        this.DEC(this.Address_AbsoluteX_Write());
    }

    private DEC_zpx(): void {
        this.DEC(this.Address_ZeroPageX());
    }

    private DEC_abs(): void {
        this.DEC(this.Address_Absolute());
    }

    private DEC_zp(): void {
        this.DEC(this.Address_ZeroPage());
    }

    // x/y

    private DEX_imp(): void {
        this.UpdateZeroNegativeFlags(--this.X);
    }

    private DEY_imp(): void {
        this.UpdateZeroNegativeFlags(--this.Y);
    }

    // inc

    private INC_a(): void {
        this.UpdateZeroNegativeFlags(++this.A);
    }

    private INC_zp(): void {
        this.INC(this.Address_ZeroPage());
    }

    private INC_absx(): void {
        this.INC(this.Address_AbsoluteX_Write());
    }

    private INC_zpx(): void {
        this.INC(this.Address_ZeroPageX());
    }

    private INC_abs(): void {
        this.INC(this.Address_Absolute());
    }

    // x/y

    private INX_imp(): void {
        this.UpdateZeroNegativeFlags(++this.X);
    }

    private INY_imp(): void {
        this.UpdateZeroNegativeFlags(++this.Y);
    }

    // writers

    // stx

    private STX_zpy(): void {
        this.WriteByte_ZeroPageY(this.X);
    }

    private STX_abs(): void {
        this.WriteByte_Absolute(this.X);
    }

    private STX_zp(): void {
        this.WriteByte_ZeroPage(this.X);
    }

    // sty

    private STY_zpx(): void {
        this.WriteByte_ZeroPageX(this.Y);
    }

    private STY_abs(): void {
        this.WriteByte_Absolute(this.Y);
    }

    private STY_zp(): void {
        this.WriteByte_ZeroPage(this.Y);
    }

    // sta

    private STA_absx(): void {
        this.WriteByte_AbsoluteX(this.A);
    }

    private STA_absy(): void {
        this.WriteByte_AbsoluteY(this.A);
    }

    private STA_zpx(): void {
        this.WriteByte_ZeroPageX(this.A);
    }

    private STA_indy(): void {
        this.WriteByte_IndirectIndexedY(this.A);
    }

    private STA_abs(): void {
        this.WriteByte_Absolute(this.A);
    }

    private STA_zp(): void {
        this.WriteByte_ZeroPage(this.A);
    }

    private STA_xind(): void {
        this.WriteByte_IndexedIndirectX(this.A);
    }

    private STA_zpind(): void {
        this.WriteByte_ZeroPageIndirect(this.A);
    }

    // stz

    private STZ_zp(): void {
        this.WriteByte_ZeroPage(0);
    }

    private STZ_zpx(): void {
        this.WriteByte_ZeroPageX(0);
    }

    private STZ_abs(): void {
        this.WriteByte_Absolute(0);
    }

    private STZ_absx(): void {
        this.WriteByte_AbsoluteX(0);
    }

    // transfers

    private TSX_imp(): void {
        this.X = this.S;
        this.UpdateZeroNegativeFlags(this.X);
    }

    private TAX_imp(): void {
        this.X = this.A;
        this.UpdateZeroNegativeFlags(this.X);
    }

    private TAY_imp(): void {
        this.Y = this.A;
        this.UpdateZeroNegativeFlags(this.Y);
    }

    private TXS_imp(): void {
        this.S = this.X;
    }

    private TYA_imp(): void {
        this.A = this.Y;
        this.UpdateZeroNegativeFlags(this.A);
    }

    private TXA_imp(): void {
        this.A = this.X;
        this.UpdateZeroNegativeFlags(this.A);
    }

    // stack operations

    private PHP_imp(): void {
        this.P.Break = true;
        this.PushByte(this.P.toNumber());
    }

    private PLP_imp(): void {
        this.P = new StatusFlags(this.PopByte());
        this.P.Reserved = true;
    }

    private PLA_imp(): void {
        this.A = this.PopByte();
        this.UpdateZeroNegativeFlags(this.A);
    }

    private PHA_imp(): void {
        this.PushByte(this.A);
    }

    private PHX_imp(): void {
        this.PushByte(this.X);
    }

    private PHY_imp(): void {
        this.PushByte(this.Y);
    }

    private PLX_imp(): void {
        this.X = this.PopByte();
        this.UpdateZeroNegativeFlags(this.X);
    }

    private PLY_imp(): void {
        this.Y = this.PopByte();
        this.UpdateZeroNegativeFlags(this.Y);
    }

    // shifts and rotations

    // asl

    private ASL_a(): void {
        this.A = this.ASL_data(this.A);
    }

    private ASL_zp(): void {
        this.ASL_contents(this.Address_ZeroPage());
    }

    private ASL_abs(): void {
        this.ASL_contents(this.Address_Absolute());
    }

    private ASL_absx(): void {
        this.ASL_contents(this.Address_AbsoluteX_Write());
    }

    private ASL_zpx(): void {
        this.ASL_contents(this.Address_ZeroPageX());
    }

    // lsr

    private LSR_absx(): void {
        this.LSR_contents(this.Address_AbsoluteX_Write());
    }

    private LSR_zpx(): void {
        this.LSR_contents(this.Address_ZeroPageX());
    }

    private LSR_abs(): void {
        this.LSR_contents(this.Address_Absolute());
    }

    private LSR_a(): void {
        this.A = this.LSR_data(this.A);
    }

    private LSR_zp(): void {
        this.LSR_contents(this.Address_ZeroPage());
    }

    // rol

    private ROL_absx(): void {
        this.ROL_contents(this.Address_AbsoluteX_Write());
    }

    private ROL_zpx(): void {
        this.ROL_contents(this.Address_ZeroPageX());
    }

    private ROL_abs(): void {
        this.ROL_contents(this.Address_Absolute());
    }

    private ROL_a(): void {
        this.A = this.ROL_data(this.A);
    }

    private ROL_zp(): void {
        this.ROL_contents(this.Address_ZeroPage());
    }

    // ror

    private ROR_absx(): void {
        this.ROR_contents(this.Address_AbsoluteX_Write());
    }

    private ROR_zpx(): void {
        this.ROR_contents(this.Address_ZeroPageX());
    }

    private ROR_abs(): void {
        this.ROR_contents(this.Address_Absolute());
    }

    private ROR_a(): void {
        this.A = this.ROR_data(this.A);
    }

    private ROR_zp(): void {
        this.ROR_contents(this.Address_ZeroPage());
    }

    // test set/reset bits

    // tsb

    private TSB_zp(): void {
        this.TSB(this.Address_ZeroPage());
    }

    private TSB_abs(): void {
        this.TSB(this.Address_Absolute());
    }

    // trb

    private TRB_zp(): void {
        this.TRB(this.Address_ZeroPage());
    }

    private TRB_abs(): void {
        this.TRB(this.Address_Absolute());
    }

    // set/reset bits

    // rmbn

    private RMB0_zp(): void {
        this.RMB(this.Address_ZeroPage(), 1);
    }

    private RMB1_zp(): void {
        this.RMB(this.Address_ZeroPage(), 2);
    }

    private RMB2_zp(): void {
        this.RMB(this.Address_ZeroPage(), 4);
    }

    private RMB3_zp(): void {
        this.RMB(this.Address_ZeroPage(), 8);
    }

    private RMB4_zp(): void {
        this.RMB(this.Address_ZeroPage(), 0x10);
    }

    private RMB5_zp(): void {
        this.RMB(this.Address_ZeroPage(), 0x20);
    }

    private RMB6_zp(): void {
        this.RMB(this.Address_ZeroPage(), 0x40);
    }

    private RMB7_zp(): void {
        this.RMB(this.Address_ZeroPage(), 0x80);
    }

    // smbn

    private SMB0_zp(): void {
        this.SMB(this.Address_ZeroPage(), 1);
    }

    private SMB1_zp(): void {
        this.SMB(this.Address_ZeroPage(), 2);
    }

    private SMB2_zp(): void {
        this.SMB(this.Address_ZeroPage(), 4);
    }

    private SMB3_zp(): void {
        this.SMB(this.Address_ZeroPage(), 8);
    }

    private SMB4_zp(): void {
        this.SMB(this.Address_ZeroPage(), 0x10);
    }

    private SMB5_zp(): void {
        this.SMB(this.Address_ZeroPage(), 0x20);
    }

    private SMB6_zp(): void {
        this.SMB(this.Address_ZeroPage(), 0x40);
    }

    private SMB7_zp(): void {
        this.SMB(this.Address_ZeroPage(), 0x80);
    }

    // jumps and calls

    private JSR_abs(): void {
        let destination: number = this.Address_Absolute();
        this.PushWord(this.PC - 1);
        this.PC = destination;
    }

    private RTI_imp(): void {
        this.PLP_imp();
        this.PC = this.PopWord();
    }

    private RTS_imp(): void {
        this.PC = this.PopWord() + 1;
    }

    private JMP_abs(): void {
        this.PC = this.Address_Absolute();
    }

    private JMP_ind(): void {
        this.PC = this.GetWord(this.Address_Absolute());
    }

    private JMP_absxind(): void {
        this.PC = this.Address_AbsoluteXIndirect();
    }

    private BRK_imp(): void {
        this.PushWord(this.PC + 1);
        this.PHP_imp();
        this.P.Interrupt = true;
        if (this.Level >= ProcessorType.Cpu65SC02) {
            this.P.Decimal = false;
        }

        this.PC = this.GetWord(MOS6502.IRQvector);
    }

    // halt and wait

    private WAI_imp(): void {
        throw new RangeError("WAI not implemented");
    }

    private STP_imp(): void {
        throw new RangeError("STP not implemented");
    }

    // flags

    private SED_imp(): void {
        this.P.Decimal = true;
    }

    private CLD_imp(): void {
        this.P.Decimal = false;
    }

    private CLV_imp(): void {
        this.P.Overflow = false;
    }

    private SEI_imp(): void {
        this.P.Interrupt = true;
    }

    private CLI_imp(): void {
        this.P.Interrupt = false;
    }

    private CLC_imp(): void {
        this.P.Carry = false;
    }

    private SEC_imp(): void {
        this.P.Carry = true;
    }

    // branches

    private BMI_rel(): void {
        this.BranchConditionally(this.P.Negative);
    }

    private BPL_rel(): void {
        this.BranchConditionally(!this.P.Negative);
    }

    private BVC_rel(): void {
        this.BranchConditionally(!this.P.Overflow);
    }

    private BVS_rel(): void {
        this.BranchConditionally(this.P.Overflow);
    }

    private BCC_rel(): void {
        this.BranchConditionally(!this.P.Carry);
    }

    private BCS_rel(): void {
        this.BranchConditionally(this.P.Carry);
    }

    private BNE_rel(): void {
        this.BranchConditionally(!this.P.Zero);
    }

    private BEQ_rel(): void {
        this.BranchConditionally(this.P.Zero);
    }

    private BRA_rel(): void {
        this.Branch();
    }

    // bit branches

    private BBR0_zprel(): void {
        this.BitBranch_Clear(0x1);
    }

    private BBR1_zprel(): void {
        this.BitBranch_Clear(0x2);
    }

    private BBR2_zprel(): void {
        this.BitBranch_Clear(0x4);
    }

    private BBR3_zprel(): void {
        this.BitBranch_Clear(0x8);
    }

    private BBR4_zprel(): void {
        this.BitBranch_Clear(0x10);
    }

    private BBR5_zprel(): void {
        this.BitBranch_Clear(0x20);
    }

    private BBR6_zprel(): void {
        this.BitBranch_Clear(0x40);
    }

    private BBR7_zprel(): void {
        this.BitBranch_Clear(0x80);
    }

    private BBS0_zprel(): void {
        this.BitBranch_Set(0x1);
    }

    private BBS1_zprel(): void {
        this.BitBranch_Set(0x2);
    }

    private BBS2_zprel(): void {
        this.BitBranch_Set(0x4);
    }

    private BBS3_zprel(): void {
        this.BitBranch_Set(0x8);
    }

    private BBS4_zprel(): void {
        this.BitBranch_Set(0x10);
    }

    private BBS5_zprel(): void {
        this.BitBranch_Set(0x20);
    }

    private BBS6_zprel(): void {
        this.BitBranch_Set(0x40);
    }

    private BBS7_zprel(): void {
        this.BitBranch_Set(0x80);
    }
}
