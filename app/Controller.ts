﻿"use strict";

import {System6502} from "./system6502";
import {Configuration} from "./Configuration";
import {AddressEventArgs} from "./AddressEventArgs";

export class Controller {

    public static get BbcOSLoadAddress(): number { return 0xc000; }
    public static get BbcOSLanguageAddress(): number { return 0x8000; }

    private _processor: System6502;
    private _configuration: Configuration;

    private _oldPC: number = 0;

    private _startTime: number;
    private _finishTime: number;

    constructor(configuration: Configuration) {
        this._configuration = configuration;
    }

    public get Processor(): System6502 { return this._processor; }
    public get StartTime(): number { return this._startTime; }
    public get FinishTime(): number { return this._finishTime; }

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
    }

    public Start(): void {
        this._processor.Run();
    }

    private Processor_Starting(): void {
        this._startTime = Date.now();
    }

    private Processor_Finished(): void {
        this._finishTime = Date.now();
    }

    private Processor_ExecutingInstruction(e: AddressEventArgs): void {

        if (this._configuration.StopAddressEnabled && this._configuration.StopAddress === e.Address) {
            this._processor.Proceed = false;
        }

        if (this._configuration.StopWhenLoopDetected) {
            if (this._oldPC === this._processor.PC) {
                this._processor.Proceed = false;
            } else {
                this._oldPC = this._processor.PC;
            }
        }

        if (this._configuration.StopBreak && this._configuration.BreakInstruction === e.Cell) {
            this._processor.Proceed = false;
        }
    }

    private Processor_WritingByte(e: AddressEventArgs): void {
        if (e.Address === this._configuration.OutputAddress) {
            this.HandleByteWritten(e.Cell);
        }
    }

    private Processor_ReadingByte(e: AddressEventArgs): void {
        if (e.Address === this._configuration.InputAddress) {
            if (e.Cell !== 0x0) {
                this.HandleByteRead(e.Cell);
                this._processor.SetByte(e.Address, 0x0);
            }
        }
    }

    private Processor_InvalidWriteAttempt(e: AddressEventArgs): void {
    }

    private Processor_Polling(): void {
    }

    private HandleByteWritten(cell: number): void {
    }

    private HandleByteRead(cell: number): void {
    }
}
