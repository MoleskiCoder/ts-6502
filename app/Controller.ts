﻿"use strict";

import {System6502} from "./system6502";
import {Configuration} from "./Configuration";
import {Symbols} from "./Symbols";
import {Disassembly} from "./Disassembly";
import {Signal} from "./Signal";
import {Instruction} from "./Instruction";
import {AddressingMode} from "./AddressingMode";

/* tslint:disable:no-bitwise */

export class Controller {

    public static get BbcOSLoadAddress(): number { return 0xc000; }
    public static get BbcOSLanguageAddress(): number { return 0x8000; }

    private _processor: System6502;
    private _configuration: Configuration;

    private _oldPC: number = 0;

    private _startTime: number;
    private _finishTime: number;

    private _cyclesPerSecond: number;
    private _cyclesPerMillisecond: number;
    private _cyclesPerInterval: number;

    private _oldCycles: number = 0;
    private _intervalCycles: number = 0;

    private _jiffies: number = 0;
    private _executingTime: number = 0;     // in 1/1000 second intervals

    private _disassembler: Disassembly;

    private _symbols: Symbols;

    private _disassembly: Signal = new Signal();

    private _timer: NodeJS.Timer;

    public static get Mega(): number {
        return 1000000;
    }

    public static get Milli(): number {
        return 0.001;
    }

    constructor(configuration: Configuration) {
        this._configuration = configuration;
    }

    public get Processor(): System6502 { return this._processor; }
    public get StartTime(): number { return this._startTime; }
    public get FinishTime(): number { return this._finishTime; }
    public get ElapsedTime(): number { return this.FinishTime - this.StartTime; }
    public get ExecutingTime(): number { return this._executingTime; }

    public get Disassembly(): Signal { return this._disassembly; }

    public Configure(): void {

        this._processor = new System6502(this._configuration.ProcessorLevel);

        if (this._configuration.Disassemble
                || this._configuration.StopAddressEnabled
                || this._configuration.StopWhenLoopDetected
                || this._configuration.ProfileAddresses
                || this._configuration.StopBreak) {
            this._processor.ExecutingInstruction.add(this.Processor_ExecutingInstruction, this);
        }

        this._processor.MemoryBus.WritingByte.add(this.Processor_WritingByte, this);
        this._processor.MemoryBus.ReadingByte.add(this.Processor_ReadingByte, this);

        this._processor.MemoryBus.InvalidWriteAttempt.add(this.Processor_InvalidWriteAttempt, this);

        this._processor.Starting.add(this.Processor_Starting, this);
        this._processor.Finished.add(this.Processor_Finished, this);

        this._processor.Polling.add(this.Processor_Polling, this);

        this._processor.Initialise();

        let bbc: boolean = (this._configuration.BbcLanguageRomPath.length > 0) && (this._configuration.BbcOSRomPath.length > 0);
        if (bbc) {
            this._processor.MemoryBus.LoadRom(this._configuration.BbcOSRomPath, Controller.BbcOSLoadAddress);
            this._processor.MemoryBus.LoadRom(this._configuration.BbcLanguageRomPath, Controller.BbcOSLanguageAddress);
        }

        let rom: boolean = this._configuration.RomPath.length > 0;
        if (rom) {
            this._processor.MemoryBus.LoadRom(this._configuration.RomPath, this._configuration.RomLoadAddress);
        }

        let ram: boolean = this._configuration.RamPath.length > 0;
        if (ram) {
            this._processor.MemoryBus.LoadRam(this._configuration.RamPath, this._configuration.RamLoadAddress);
        }

        if (this._configuration.ResetStart) {
            this._processor.Reset();
        } else {
            this._processor.Start(this._configuration.StartAddress);
        }

        this._symbols = new Symbols(this._configuration.DebugFile);

        this._disassembler = new Disassembly(this._processor, this._symbols);
        this.Disassembly.add(this.Controller_Disassembly, this);

        this._cyclesPerSecond = this._configuration.Speed * Controller.Mega;     // speed is in MHz
        this._cyclesPerMillisecond = this._cyclesPerSecond * Controller.Milli;
        this._cyclesPerInterval = this._cyclesPerMillisecond * this._configuration.PollIntervalMilliseconds;
    }

    public Start(): void {
        this._processor.Starting.dispatch();
        this._timer = setInterval(() => { this.Poll(); }, this._configuration.PollIntervalMilliseconds);
    }

    private Poll(): void {

        let currentTime: number = Date.now();

        let calculatedElapsed: number = this._configuration.PollIntervalMilliseconds * this._jiffies;
        let actualElapsed: number = currentTime - this.StartTime;

        let allowedCycles: number = this._cyclesPerInterval;
        if (actualElapsed > calculatedElapsed) {
            let difference: number = actualElapsed - calculatedElapsed;
            let missedJiffies: number = (difference / this._configuration.PollIntervalMilliseconds) | 0;
            allowedCycles += missedJiffies * this._cyclesPerInterval;
        }

        let start: number[] = process.hrtime();
        while (this._processor.Proceed && (this._intervalCycles < allowedCycles)) {
            this._processor.Step();
            this._intervalCycles += (this._processor.Cycles - this._oldCycles);
        }
        let elapsed: number[] = process.hrtime(start);
        this._executingTime += ((elapsed[1] / 1e6) + (1000 * elapsed[0]));

        // rather than zero, so we catch any cycle overruns...
        this._intervalCycles -= this._cyclesPerInterval;

        // if we've finished processing (for whatever reason),
        if (!this._processor.Proceed) {
            // allow the NodeJS loop to exit
            this._timer.unref();
            // fire the final "finished" event
            this._processor.Finished.dispatch();
        }

        ++this._jiffies;
    }

    private Processor_Starting(): void {
        this._startTime = Date.now();
    }

    private Processor_Finished(): void {
        this._finishTime = Date.now();
    }

    private Processor_ExecutingInstruction(address: number, cell: number): void {

        if (this._configuration.Disassemble) {
            let cycles: string = Disassembly.pad(this._processor.Cycles, 10, 9);
            let hexAddress: string = Disassembly.Dump_WordValue(address);
            let p: string = this._processor.P.toString();
            let a: string = Disassembly.Dump_ByteValue(this._processor.A);
            let x: string = Disassembly.Dump_ByteValue(this._processor.X);
            let y: string = Disassembly.Dump_ByteValue(this._processor.Y);
            let s: string = Disassembly.Dump_ByteValue(this._processor.S);
            let state: string = `[${cycles}] PC=${hexAddress}:P=${p}, A=${a}, X=${x}, Y=${y}, S=${s}`;

            let instruction: Instruction = this._processor.Instructions[cell];
            let mode: AddressingMode = instruction.Mode;
            let bytes: string = `${Disassembly.Dump_ByteValue(cell)}${this._disassembler.DumpBytes(mode, address + 1)}`;

            let disassembly: string = `${state}\t${bytes}\t${this._disassembler.Disassemble(address)}`;
            this.Disassembly.dispatch(disassembly);
        }

        if (this._configuration.StopAddressEnabled && this._configuration.StopAddress === address) {
            this._processor.Proceed = false;
        }

        if (this._configuration.StopWhenLoopDetected) {
            if (this._oldPC === this._processor.PC) {
                this._processor.Proceed = false;
            } else {
                this._oldPC = this._processor.PC;
            }
        }

        if (this._configuration.StopBreak && this._configuration.BreakInstruction === cell) {
            this._processor.Proceed = false;
        }

        this._oldCycles = this._processor.Cycles;
    }

    private Controller_Disassembly(output: string): void {
        console.log(output);
    }

    private Processor_WritingByte(address: number, cell: number): void {
        if (address === this._configuration.OutputAddress) {
            this.HandleByteWritten(cell);
        }
    }

    private Processor_ReadingByte(address: number, cell: number): void {
        if (address === this._configuration.InputAddress) {
            if (cell !== 0x0) {
                this.HandleByteRead(cell);
                this._processor.SetByte(address, 0x0);
            }
        }
    }

    private Processor_InvalidWriteAttempt(address: number, cell: number): void {
    }

    private Processor_Polling(): void {
    }

    private HandleByteWritten(cell: number): void {
        let character: string = String.fromCharCode(cell);
        if (this._configuration.BbcVduEmulation) {
            switch (cell) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                    break;
                case 7:
                    break;
                case 8:
                    break;
                case 9:
                    break;
                case 10:
                    process.stdout.write(character);
                    break;
                case 11:
                    break;
                case 12:
                    break;
                case 13:
                    process.stdout.write(character);
                    break;
                case 14:
                case 15:
                case 16:
                case 17:
                case 18:
                case 19:
                case 20:
                case 21:
                case 22:
                case 23:
                case 24:
                case 25:
                case 26:
                case 27:
                case 28:
                case 29:
                    break;
                case 30:
                    break;
                case 31:
                    break;
                case 127:
                    break;
                default:
                    process.stdout.write(character);
                    break;
            }
        } else {
            process.stdout.write(character);
        }
    }

    private HandleByteRead(cell: number): void {
    }
}
