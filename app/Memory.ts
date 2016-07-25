"use strict";

import {IMemory} from "./IMemory";

import * as FS from "fs";
import {EventEmitter} from "events";

export class Memory extends EventEmitter implements IMemory {

    private _memory: number[];
    private _locked: boolean[];
    private _memorySize: number;

    constructor(memorySize: number) {
        super();
        this._memorySize = memorySize;
    }

    public ClearMemory(): void {
        this._memory = Array(this._memorySize);
        for (let i: number = 0; i < this._memorySize; ++i) {
            this._memory[i] = 0;
        }
    }

    public ClearLocking(): void {
        this._locked = Array(this._memorySize);
        for (let i: number = 0; i < this._memorySize; ++i) {
            this._locked[i] = false;
        }
    }

    public GetByte(offset: number): number {
        let content: number = this._memory[offset];
        this.emit("readingByte", offset, content);
        return content;
    }

    public SetByte(offset: number, value: number): void {
        if (this._locked[offset]) {
            this.emit("invalidWriteAttempt", offset, value);
        } else {
            this._memory[offset] = value;
            this.emit("writingByte", offset, value);
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
