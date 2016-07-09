"use strict";

import {Signal} from "./Signal";
import {AddressEventArgs} from "./AddressEventArgs";
import {IMemory} from "./IMemory";

import * as FS from "fs";

export class Memory implements IMemory {

    private _memory: number[];
    private _locked: boolean[];
    private _memorySize: number;

    private _invalidWriteAttempt: Signal = new Signal();
    private _writingByte: Signal = new Signal();
    private _readingByte: Signal = new Signal();

    constructor(memorySize: number) {
        this._memorySize = memorySize;
    }

    public get InvalidWriteAttempt(): Signal { return this._invalidWriteAttempt; }
    public get WritingByte(): Signal { return this._writingByte; }
    public get ReadingByte(): Signal { return this._readingByte; }

    public ClearMemory(): void {
        this._memory = Array(this._memorySize);
    }

    public ClearLocking(): void {
        this._locked = Array(this._memorySize);
    }

    public GetByte(offset: number): number {
        let content: number = this._memory[offset];
        this._readingByte.dispatch(offset, content);
        return content;
    }

    public SetByte(offset: number, value: number): void {
        if (this._locked[offset]) {
            this._invalidWriteAttempt.dispatch(offset, value);
        } else {
            this._memory[offset] = value;
            this._writingByte.dispatch(offset, value);
        }
    }

    public LoadRom(path: string, offset: number): void {
        let length: number = this.LoadMemory(path, offset);
        this.LockMemory(offset, length);
    }

    public LoadRam(path: string, offset: number): void {
        this.LoadMemory(path, offset);
    }

    public LockMemory(offset: number, length: number): void {
        for (let i: number = 0; i < length; ++i) {
            this._locked[offset + i] = true;
        }
    }

    public LoadMemory(path: string, offset: number): number {

        let buffer: Buffer = FS.readFileSync(path);

        let size: number = buffer.length;
        if (size > this._memorySize) {
            throw new RangeError("File is too large");
        }

        buffer.forEach((currentValue: number, index: number) => {
            this._memory[offset + index] = currentValue;
        });

        return size;
    }
}
