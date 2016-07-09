"use strict";

export interface IMemory {

    GetByte(offset: number): number;
    SetByte(offset: number, value: number): void;

    ClearMemory(): void;
    ClearLocking(): void;

    LoadRom(path: string, offset: number): void;
    LoadRam(path: string, offset: number): void;
    LockMemory(offset: number, length: number): void;
    LoadMemory(path: string, offset: number): number;
}
