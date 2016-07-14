"use strict";

import {Memory} from "./Memory";
import {MOS6502} from "./mos6502";
import {ProcessorType} from "./ProcessorType";
import {Signal} from "./Signal";

export class System6502 extends MOS6502 {

    private _memory: Memory;

    private _startTime: number;

    private _starting: Signal = new Signal();
    private _finished: Signal = new Signal();
    private _polling: Signal = new Signal();
    private _executingInstruction: Signal = new Signal();
    private _executedInstruction: Signal = new Signal();

    public static get MemorySize(): number {
        return 0x10000;
    }

    constructor(level: ProcessorType) {
        super(level);

        this._memory = new Memory(System6502.MemorySize);

        this.Starting.add(this.System6502_Starting, this);
    }

    public get Starting(): Signal {
        return this._starting;
    }

    public get Finished(): Signal {
        return this._finished;
    }

    public get Polling(): Signal {
        return this._polling;
    }

    public get ExecutingInstruction(): Signal {
        return this._executingInstruction;
    }

    public get ExecutedInstruction(): Signal {
        return this._executedInstruction;
    }

    public get MemoryBus(): Memory {
        return this._memory;
    }

    public Initialise(): void {
        super.Initialise();
        this._memory.ClearLocking();
        this._memory.ClearMemory();
    }

    public GetByte(offset: number): number {
        return this._memory.GetByte(offset);
    }

    public SetByte(offset: number, value: number): void {
        this._memory.SetByte(offset, value);
    }

    protected Execute(cell: number): void {

        // fetch byte has already incremented PC.
        let executingAddress: number = this.PC - 1;

        this.ExecutingInstruction.dispatch(executingAddress, cell);
        super.Execute(cell);
        this.ExecutedInstruction.dispatch(executingAddress, cell);
    }

    private System6502_Starting(): void {
        this._startTime = Date.now();
    }
}
