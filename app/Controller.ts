"use strict";

// import * as keypress from "keypress";
let keypress: any = require("keypress");

import {EventEmitter} from "events";
import * as FS from "fs";

import {System6502} from "./system6502";
import {Configuration} from "./Configuration";
import {Symbols} from "./Symbols";
import {Disassembly} from "./Disassembly";
import {Instruction} from "./Instruction";
import {AddressingMode} from "./AddressingMode";
import {Profiler} from "./Profiler";
import {WriteStream} from "fs";

export class Controller extends EventEmitter {

    public static get BbcOSLoadAddress(): number { return 0xc000; }
    public static get BbcOSLanguageAddress(): number { return 0x8000; }

    private _processor: System6502;
    private _configuration: Configuration;

    private _oldPC: number = 0;

    private _disassembler: Disassembly;
    private _disassemblyLog: WriteStream;

    private _profiler: Profiler;

    private _symbols: Symbols;

    private _keyboardAvailable: boolean = false;


    private static Profiler_FinishedScopeOutput(): void {
        console.log("Finished profiler scope output...");
    }

    private static Profiler_StartingScopeOutput(): void {
        console.log("Starting profiler scope output...");
    }

    private static Profiler_FinishedLineOutput(): void {
        console.log("Finished profiler line output...");
    }

    private static Profiler_StartingLineOutput(): void  {
        console.log("Starting profiler line output...");
    }

    private static Profiler_FinishedOutput(): void {
        console.log("Finished profiler output...");
    }

    private static Profiler_StartingOutput(): void {
        console.log("Starting profiler output...");
    }

    constructor(configuration: Configuration) {
        super();
        this._configuration = configuration;
    }

    public get Processor(): System6502 { return this._processor; }

    public Configure(): void {

        this._processor = new System6502(
            this._configuration.ProcessorLevel,
            this._configuration.Speed,
            this._configuration.PollIntervalMilliseconds);

        if (this._configuration.Disassemble
                || this._configuration.StopAddressEnabled
                || this._configuration.StopWhenLoopDetected
                || this._configuration.ProfileAddresses
                || this._configuration.StopBreak) {
            this._processor.on("executingInstruction", (address: number, cell: number) => {
                this.Processor_ExecutingInstruction(address, cell);
            });
        }

        this._processor.MemoryBus.on("writingByte", (address: number, cell: number) => {
            this.Processor_WritingByte(address, cell);
        });
        this._processor.MemoryBus.on("readingByte", (address: number, cell: number) => {
            this.Processor_ReadingByte(address, cell);
        });

        this._processor.on("starting", () => {
            if (this._configuration.DisassemblyLogPath !== "") {
                this._disassemblyLog = FS.createWriteStream(this._configuration.DisassemblyLogPath);
            }
        });

        this._processor.on("finished", () => {
            if (this._disassemblyLog !== undefined) {
                this._disassemblyLog.end();
            }
            this._profiler.Generate();
        });

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
        this.on("disassembly", (output: string) => {
            this.Controller_Disassembly(output);
        });

        this._profiler = new Profiler(
            this._processor,
            this._disassembler,
            this._symbols,
            this._configuration.CountInstructions,
            this._configuration.ProfileAddresses);
        this._profiler.on("startingOutput", () => { Controller.Profiler_StartingOutput(); });
        this._profiler.on("finishedOutput", () => { Controller.Profiler_FinishedOutput(); });
        this._profiler.on("startingLineOutput", () => { Controller.Profiler_StartingLineOutput(); });
        this._profiler.on("finishedLineOutput", () => { Controller.Profiler_FinishedLineOutput(); });
        this._profiler.on("startingScopeOutput", () => { Controller.Profiler_StartingScopeOutput(); });
        this._profiler.on("finishedScopeOutput", () => { Controller.Profiler_FinishedScopeOutput(); });
        this._profiler.on("emitLine", (source: string, cycles: number) => {
            this.Profiler_EmitLine(source, cycles);
        });
        this._profiler.on("emitScope", (scope: string, cycles: number, count: number) => {
            this.Profiler_EmitScope(scope, cycles, count);
        });
    }

    public Start(): void {
        this._processor.Run();

        let stdin: any = process.stdin;
        this._keyboardAvailable = stdin.setRawMode !== undefined;
        if (this._keyboardAvailable) {

            keypress(process.stdin);

            // send "keypress" events to the input address
            process.stdin.on("keypress", (ch: string, key: any) => {
                if (key && key.ctrl && key.name === "c") {
                    this._processor.Proceed = false;
                } else {
                    this._processor.SetByte(this._configuration.InputAddress, ch.charCodeAt(0));
                }
            });

            // allow stdin to exit when the emulator has completed
            this._processor.on("finished", () => { process.stdin.pause(); });

            stdin.setRawMode(true);
            stdin.resume();
        }
    }

    private Processor_ExecutingInstruction(address: number, cell: number): void {

        if (this._configuration.Disassemble) {
            let cycles: string = Disassembly.pad(this._processor.Cycles, 9);
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
            this.emit("disassembly", disassembly);
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
        if (this._configuration.Debug) {
            let character: string = String.fromCharCode(cell);
            console.log(`Byte read: character=${character}, cell=${cell}`);
        }
    }

    private Profiler_EmitScope(scope: string, cycles: number, count: number): void {
        let proportion: number = cycles / this._processor.Cycles;
        let proportionPercentage: string = (proportion * 100).toFixed(2);
        console.log(`\t[${proportionPercentage}%][${Disassembly.pad(cycles, 9)}][${Disassembly.pad(count, 9)}]\t${scope}`);
    }

    private Profiler_EmitLine(source: string, cycles: number): void {
        let proportion: number = cycles / this._processor.Cycles;
        let proportionPercentage: string = (proportion * 100).toFixed(2);
        console.log(`\t[${proportionPercentage}%][${Disassembly.pad(cycles, 9)}]\t${source}`);
    }

    private Controller_Disassembly(output: string): void {
        if (this._configuration.Debug) {
            console.log(output);
        }
        if (this._disassemblyLog !== undefined) {
            this._disassemblyLog.write(`${output}\n`);
        }
    }
}
