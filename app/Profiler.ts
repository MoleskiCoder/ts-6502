"use strict";

import {System6502} from "./system6502";
import {Disassembly} from "./Disassembly";
import {Symbols} from "./Symbols";

import {EventEmitter} from "events";

export class Profiler extends EventEmitter {

    private _instructionCounts: number[];
    private _addressProfiles: number[];
    private _addressCounts: number[];

    private _addressScopes: string[];

    private _scopeCycles: any = {};

    private _processor: System6502;
    private _disassembler: Disassembly;
    private _symbols: Symbols ;

    private _countInstructions: boolean;
    private _profileAddresses: boolean;

    private _priorCycleCount: number = 0;

    constructor(processor: System6502, disassembler: Disassembly, symbols: Symbols, countInstructions: boolean, profileAddresses: boolean) {

        super();

        this._processor = processor;
        this._disassembler = disassembler;
        this._symbols = symbols;
        this._countInstructions = countInstructions;
        this._profileAddresses = profileAddresses;

        if (countInstructions || profileAddresses) {
            this._processor.on("executingInstruction", (address: number, cell: number) => {
                this.Processor_ExecutingInstruction(address, cell);
            });
        }

        if (profileAddresses) {
            this._processor.on("executedInstruction", (address: number, cell: number) => {
                this.Processor_ExecutedInstruction(address, cell);
            });
        }

        this._instructionCounts = Array(0x100);
        for (let i: number = 0; i < 0x100; ++i) {
            this._instructionCounts[i] = 0;
        }

        this._addressProfiles = Array(0x10000);
        this._addressCounts = Array(0x10000);

        this._addressScopes = Array(0x10000);

        for (let i: number = 0; i < 0x10000; ++i) {
            this._addressProfiles[i] = 0;
            this._addressCounts[i] = 0;
        }

        this.BuildAddressScopes();
    }

    public Generate(): void {
        this.emit("startingOutput");
        this.EmitProfileInformation();
        this.emit("finishedOutput");
    }

    private EmitProfileInformation(): void {

        this.emit("startingLineOutput");
        // for each memory address
        for (let i: number = 0; i < 0x10000; ++i) {
            // if there are any cycles associated
            let cycles: number = this._addressProfiles[i];
            if (cycles > 0) {
                // dump a profile/disassembly line
                let source: string = this._disassembler.Disassemble(i);
                this.emit("emitLine", source, cycles);
            }
        }
        this.emit("finishedLineOutput");

        this.emit("startingScopeOutput");
        for (let name in this._scopeCycles) {
            if (this._scopeCycles.hasOwnProperty(name)) {
                let cycles: number = this._scopeCycles[name];
                let count: number = this._addressCounts[this._symbols.Addresses[name]];
                this.emit("emitScope", name, cycles, count);
            }
        }
        this.emit("finishedScopeOutput");
    }

    private Processor_ExecutingInstruction(address: number, cell: number): void {
        if (this._profileAddresses) {
            this._priorCycleCount = this._processor.Cycles;
            this._addressCounts[address]++;
        }

        if (this._countInstructions) {
            ++this._instructionCounts[cell];
        }
    }

    private Processor_ExecutedInstruction(address: number, cell: number): void {
        if (this._profileAddresses) {
            let cycles: number = this._processor.Cycles - this._priorCycleCount;

            this._addressProfiles[address] += cycles;

            let addressScope: string = this._addressScopes[address];
            if (addressScope !== undefined) {
                if (!this._scopeCycles.hasOwnProperty(addressScope)) {
                    this._scopeCycles[addressScope] = 0;
                }

                let oldCycles: number = this._scopeCycles[addressScope];
                let newCycles: number = oldCycles + cycles;
                this._scopeCycles[addressScope] += cycles;
                console.assert(this._scopeCycles[addressScope] === newCycles);
            }
        }
    }

    private BuildAddressScopes(): void {
        for (let address in this._symbols.Labels) {
            if (this._symbols.Labels.hasOwnProperty(address)) {
                let key: string = this._symbols.Labels[address];
                let scope: number = this._symbols.Scopes[key];
                if (scope !== undefined) {
                    let addressInteger: number = parseInt(address, 10);
                    for (let i: number = addressInteger; i < (addressInteger + scope); ++i) {
                        this._addressScopes[i] = key;
                    }
                }
            }
        }
    }
}
