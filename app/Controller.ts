"use strict";

import {EventEmitter} from "events";

import {System6502} from "./system6502";
import {Configuration} from "./Configuration";
import {Symbols} from "./Symbols";
import {Disassembly} from "./Disassembly";
import {Instruction} from "./Instruction";
import {AddressingMode} from "./AddressingMode";

export class Controller extends EventEmitter {

    public static get BbcOSLoadAddress(): number { return 0xc000; }
    public static get BbcOSLanguageAddress(): number { return 0x8000; }

    private _processor: System6502;
    private _configuration: Configuration;

    private _oldPC: number = 0;

    private _disassembler: Disassembly;

    private _symbols: Symbols;

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
        this._processor.on("disassembly", (output: string) => {
            this.Controller_Disassembly(output);
        });
    }

    public Start(): void {
        this._processor.Run();
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
