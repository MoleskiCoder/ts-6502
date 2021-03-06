﻿"use strict";

import {Memory} from "./Memory";
import {MOS6502} from "./mos6502";
import {ProcessorType} from "./ProcessorType";

/* tslint:disable:no-bitwise */
export class System6502 extends MOS6502 {

    private _memory: Memory;

    private _pollInterval: number;      // in milliseconds
    private _startTime: number;
    private _finishTime: number;

    private _cyclesPerSecond: number;
    private _cyclesPerMillisecond: number;
    private _cyclesPerInterval: number;

    private _oldCycles: number = 0;
    private _intervalCycles: number = 0;

    private _jiffies: number = 0;
    private _executingTime: number = 0;     // in 1/1000 second intervals

    private _timer: NodeJS.Timer;

    public static get Mega(): number {
        return 1000000;
    }

    public static get Milli(): number {
        return 0.001;
    }

    public static get MemorySize(): number {
        return 0x10000;
    }

    constructor(level: ProcessorType, processorSpeed: number, pollInterval: number) {

        super(level);

        this._pollInterval = pollInterval;

        this._cyclesPerSecond = processorSpeed * System6502.Mega;     // speed is in MHz
        this._cyclesPerMillisecond = this._cyclesPerSecond * System6502.Milli;
        this._cyclesPerInterval = this._cyclesPerMillisecond * this._pollInterval;

        this._memory = new Memory(System6502.MemorySize);
    }

    public get MemoryBus(): Memory {
        return this._memory;
    }

    public get StartTime(): number { return this._startTime; }
    public get FinishTime(): number { return this._finishTime; }
    public get ElapsedTime(): number { return this.FinishTime - this.StartTime; }
    public get ExecutingTime(): number { return this._executingTime; }

    public Initialise(): void {
        super.Initialise();
        this._memory.ClearLocking();
        this._memory.ClearMemory();
    }

    public Run(): void {
        this.emit("starting");
        this._startTime = Date.now();
        this._timer = setInterval(() => { this.Poll(); }, this._pollInterval);
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

        this._oldCycles = this.Cycles;

        this.emit("executingInstruction", executingAddress, cell);
        super.Execute(cell);
        this.emit("executedInstruction", executingAddress, cell);
    }

    protected Poll(): void {

        let currentTime: number = Date.now();

        let calculatedElapsed: number = this._pollInterval * this._jiffies++;
        let actualElapsed: number = currentTime - this.StartTime;

        let allowedCycles: number = this._cyclesPerInterval;
        if (actualElapsed > calculatedElapsed) {
            let difference: number = actualElapsed - calculatedElapsed;
            let missedJiffies: number = (difference / this._pollInterval) | 0;
            allowedCycles += missedJiffies * this._cyclesPerInterval;
        }

        let start: number[] = process.hrtime();
        while (this.Proceed && (this._intervalCycles < allowedCycles)) {
            this.Step();
            this._intervalCycles += (this.Cycles - this._oldCycles);
        }
        let elapsed: number[] = process.hrtime(start);
        this._executingTime += ((elapsed[1] / 1e6) + (1000 * elapsed[0]));

        // rather than zero, so we catch any cycle overruns...
        this._intervalCycles -= this._cyclesPerInterval;

        // if we've finished processing (for whatever reason),
        if (!this.Proceed) {

            // allow the NodeJS loop to exit
            this._timer.unref();

            this._finishTime = Date.now();

            // fire the final "finished" event
            this.emit("finished");
        }
    }
}
