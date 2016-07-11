"use strict";

import {ProcessorType} from "./ProcessorType";
import {ConfigurationReader} from "./ConfigurationReader";

export class Configuration extends ConfigurationReader {

    // cpu section
    private _hostSpeed: number = 2900;

    // host section
    private _processorLevel: ProcessorType = ProcessorType.Cpu6502;
    private _speed: number = 2.0;
    private _pollIntervalMilliseconds: number = 10;

    // i/o section
    private _inputAddress: number = 0;
    private _outputAddress: number = 0;

    // rom section
    private _romPath: string = "";
    private _romLoadAddress: number = 0;

    // ram section
    private _ramPath: string = "";
    private _ramLoadAddress: number = 0;

    // bbc section
    private _bbcLanguageRomPath: string = "";
    private _bbcOSRomPath: string = "";
    private _bbcVduEmulation: boolean = false;

    // run section
    private _startAddress: number = 0;
    private _resetStart: boolean = false;
    private _stopBreak: boolean = false;
    private _breakInstruction: number = 0;
    private _stopWhenLoopDetected: boolean = false;
    private _stopAddress: number = 0;
    private _stopAddressEnabled: boolean = false;

    // debug/release
    private _disassemble: boolean = false;
    private _disassemblyLogPath: string = "";
    private _debugFile: string = "";
    private _countInstructions: boolean = false;
    private _profileAddresses: boolean = false;

    constructor(path: string, debug: boolean) {

        super(path);

        if (this.Root.Host !== undefined) {
            if (this.Root.Host.speed !== undefined) {
                this._hostSpeed = this.Root.Host.speed;
            }
        }

        if (this.Root.CPU !== undefined) {
            if (this.Root.CPU.level !== undefined) {
                this._processorLevel = this.Root.CPU.level;
            }
            if (this.Root.CPU.speed !== undefined) {
                this._speed = this.Root.CPU.speed;
            }
            if (this.Root.CPU.pollIntervalMilliseconds !== undefined) {
                this._pollIntervalMilliseconds = this.Root.CPU.pollIntervalMilliseconds;
            }
        }

        if (this.Root.IO !== undefined) {
            if (this.Root.IO.inputAddress !== undefined) {
                this._inputAddress = parseInt(this.Root.IO.inputAddress, 16);
            }
            if (this.Root.IO.outputAddress !== undefined) {
                this._outputAddress = parseInt(this.Root.IO.outputAddress, 16);
            }
        }

        if (this.Root.ROM !== undefined) {
            if (this.Root.ROM.path !== undefined) {
                this._romPath = this.Root.ROM.path;
            }
            if (this.Root.ROM.loadAddress !== undefined) {
                this._romLoadAddress = parseInt(this.Root.ROM.loadAddress, 16);
            }
        }

        if (this.Root.RAM !== undefined) {
            if (this.Root.RAM.path !== undefined) {
                this._ramPath = this.Root.RAM.path;
            }
            if (this.Root.RAM.loadAddress !== undefined) {
                this._ramLoadAddress = parseInt(this.Root.RAM.loadAddress, 16);
            }
        }

        if (this.Root.BBC !== undefined) {
            if (this.Root.BBC.OS !== undefined) {
                if (this.Root.BBC.OS.path !== undefined) {
                    this._bbcOSRomPath = this.Root.BBC.OS.path;
                }
            }
            if (this.Root.BBC.language !== undefined) {
                if (this.Root.BBC.language.path !== undefined) {
                    this._bbcLanguageRomPath = this.Root.BBC.language.path;
                }
            }
            if (this.Root.BBC.VDUEmulation !== undefined) {
                this._bbcVduEmulation = this.Root.BBC.VDUEmulation;
            }
        }

        if (this.Root.run !== undefined) {
            if (this.Root.run.startAddress !== undefined) {
                this._startAddress = parseInt(this.Root.run.startAddress, 16);
            }
            if (this.Root.run.resetStart !== undefined) {
                this._resetStart = this.Root.run.resetStart;
            }
            if (this.Root.run.stopBreak !== undefined) {
                this._stopBreak = this.Root.run.stopBreak;
            }
            if (this.Root.run.breakInstruction !== undefined) {
                this._breakInstruction = parseInt(this.Root.run.breakInstruction, 16);
            }
            if (this.Root.run.stopWhenLoopDetected !== undefined) {
                this._stopWhenLoopDetected = this.Root.run.stopWhenLoopDetected;
            }
            if (this.Root.run.stopAddress !== undefined) {
                this._stopAddress = parseInt(this.Root.run.stopAddress, 16);
            }
        }

        this._stopAddressEnabled = this._stopAddress != 0;

        if (debug) {
            if (this.Root.debug !== undefined) {
                if (this.Root.debug.disassemble !== undefined) {
                    this._disassemble = this.Root.debug.disassemble;
                }
                if (this.Root.debug.disassemblyLogPath !== undefined) {
                    this._disassemblyLogPath = this.Root.debug.disassemblyLogPath;
                }
                if (this.Root.debug.debugFile !== undefined) {
                    this._debugFile = this.Root.debug.debugFile;
                }
                if (this.Root.debug.countInstructions !== undefined) {
                    this._countInstructions = this.Root.debug.countInstructions;
                }
                if (this.Root.debug.profileAddresses !== undefined) {
                    this._profileAddresses = this.Root.debug.profileAddresses;
                }
            }
        } else {
            if (this.Root.release !== undefined) {
                if (this.Root.release.disassemble !== undefined) {
                    this._disassemble = this.Root.release.disassemble;
                }
                if (this.Root.release.disassemblyLogPath !== undefined) {
                    this._disassemblyLogPath = this.Root.release.disassemblyLogPath;
                }
                if (this.Root.release.debugFile !== undefined) {
                    this._debugFile = this.Root.release.debugFile;
                }
                if (this.Root.release.countInstructions !== undefined) {
                    this._countInstructions = this.Root.release.countInstructions;
                }
                if (this.Root.release.profileAddresses !== undefined) {
                    this._profileAddresses = this.Root.release.profileAddresses;
                }
            }
        }
    }

    public get HostSpeed(): number { return this._hostSpeed; }

    public get ProcessorLevel(): ProcessorType { return this._processorLevel; }
    public get Speed(): number { return this._speed; }
    public get PollIntervalMilliseconds(): number { return this._pollIntervalMilliseconds; }

    public get InputAddress(): number { return this._inputAddress; }
    public get OutputAddress(): number { return this._outputAddress; }

    public get RomPath(): string { return this._romPath; }
    public get RomLoadAddress(): number { return this._romLoadAddress; }

    public get RamPath(): string { return this._ramPath; }
    public get RamLoadAddress(): number { return this._ramLoadAddress; }

    public get BbcLanguageRomPath(): string { return this._bbcLanguageRomPath; }
    public get BbcOSRomPath(): string { return this._bbcOSRomPath; }
    public get BbcVduEmulation(): boolean { return this._bbcVduEmulation; }

    public get StartAddress(): number { return this._startAddress; }
    public get ResetStart(): boolean { return this._resetStart; }
    public get StopBreak(): boolean { return this._stopBreak; }
    public get BreakInstruction(): number { return this._breakInstruction; }
    public get StopWhenLoopDetected(): boolean { return this._stopWhenLoopDetected; }
    public get StopAddress(): number { return this._stopAddress; }
    public get StopAddressEnabled(): boolean { return this._stopAddressEnabled; }

    public get Disassemble(): boolean { return this._disassemble; }
    public get DisassemblyLogPath(): string { return this._disassemblyLogPath; }
    public get DebugFile(): string { return this._debugFile; }
    public get CountInstructions(): boolean { return this._countInstructions; }
    public get ProfileAddresses(): boolean { return this._profileAddresses; }
}
