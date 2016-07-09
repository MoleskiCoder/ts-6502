"use strict";

import {Memory} from "./Memory";
import {MOS6502} from "./mos6502";
import {ProcessorType} from "./ProcessorType";
import {Signal} from "./Signal";
import {AddressEventArgs} from "./AddressEventArgs";

export class System6502 extends MOS6502 {

    private _memory: Memory;

    private _speed: number;  // speed in MHz, e.g. 2.0 == 2Mhz, 1.79 = 1.79Mhz

    private _startTime: number;

    private _cyclesPerSecond: number;
    private _cyclesPerMillisecond: number;
    private _cyclesPerInterval: number;

    private _intervalCycles: number;

    private _running: boolean = false;
    private _heldCycles: number = 0;

    private _starting: Signal = new Signal();
    private _finished: Signal = new Signal();
    private _polling: Signal = new Signal();
    private _executingInstruction: Signal = new Signal();
    private _executedInstruction: Signal = new Signal();

    public static get Mega(): number {
        return 1000000;
    }

    public static get Milli(): number {
        return 0.001;
    }

    public static get MemorySize(): number {
        return 0x10000;
    }

    constructor(level: ProcessorType, speed: number, pollInterval: number) {

        super(level);

        this._memory = new Memory(System6502.MemorySize);

        this._speed = speed;

        this._cyclesPerSecond = this._speed * System6502.Mega;     // speed is in MHz
        this._cyclesPerMillisecond = this._cyclesPerSecond * System6502.Milli;
        this._cyclesPerInterval = this._cyclesPerMillisecond * pollInterval;
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

    public get HeldCycles(): number {
        return this._heldCycles;
    }

    public get Running(): boolean {
        return this._running;
    }

    public get MemoryBus(): Memory {
        return this._memory;
    }

    public Initialise(): void {
        super.Initialise();
        this._memory.ClearLocking();
        this._memory.ClearMemory();
    }

    public Run(): void {

        this.Starting.add(this.System6502_Starting, this);
        this.Finished.add(this.System6502_Finished, this);

        this.Starting.dispatch();
        super.Run();
        this.Finished.dispatch();
    }

    public GetByte(offset: number): number {
        return this._memory.GetByte(offset);
    }

    public SetByte(offset: number, value: number): void {
        this._memory.SetByte(offset, value);
    }

    protected Execute(cell: number): void {

        let oldCycles: number = this.Cycles;

        this.CheckPoll();

        // fetch byte has already incremented PC.
        let executingAddress: number = this.PC - 1;

        let executing: AddressEventArgs = new AddressEventArgs(executingAddress, cell);
        this.ExecutingInstruction.dispatch(executing);
        super.Execute(cell);
        this.ExecutedInstruction.dispatch(executing);

        this._intervalCycles += (this.Cycles - oldCycles);
    }

    private CheckPoll(): void {
        if (this._intervalCycles >= this._cyclesPerInterval) {
            this._intervalCycles -= this._cyclesPerInterval;
            this.Throttle();
            this.Polling.dispatch();
        }
    }

    private System6502_Starting(): void {
        this._startTime = (new Date()).getTime();
        this._running = true;
    }

    private System6502_Finished(): void {
        this._running = false;
    }

    private Throttle(): void {

        let elapsedTime: number = Date.now() - this._startTime;

        let cyclesAllowed: number = elapsedTime * this._cyclesPerMillisecond;
        let cyclesMismatch: number = this.Cycles - cyclesAllowed;
        if (cyclesMismatch > 0.0) {
            let delay: number = cyclesMismatch / this._cyclesPerMillisecond;
            if (delay > 0) {
                this._heldCycles += cyclesMismatch;
                // system.Threading.Thread.Sleep(delay);
            }
        }
    }
}
