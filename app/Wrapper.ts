"use strict";

import {Configuration} from "./Configuration";
import {Controller} from "./Controller";
import {Disassembly} from "./Disassembly";

/* tslint:disable:no-bitwise */

export class Wrapper {

    private _configuration: Configuration;
    private _controller: Controller;

    constructor(configurationPath: string, debug: boolean) {
        this._configuration = new Configuration(configurationPath, debug);
        this._controller = new Controller(this._configuration);
    }

    public Start(): void {
        this._controller.Configure();

        this._controller.Processor.Finished.add(this.Finished, this);
        this._controller.Start();
    }

    private Finished(): void {

        let hertz: number = this._configuration.Speed * Controller.Mega;

        let cycles: number = this._controller.Processor.Cycles;

        let start: number = this._controller.StartTime;
        let finish: number = this._controller.FinishTime;

        let elapsedTime: number = finish - start;
        let seconds: number = elapsedTime * Controller.Milli;
        let cyclesPerSecond: number = cycles / seconds;
        let simulatedElapsed: number = cycles / hertz;
        let speedup: number = cyclesPerSecond / hertz;

        let executionSeconds: number = this._controller.ExecutingTime * Controller.Milli;
        let executionProportion: number = (this._controller.ExecutingTime / this._controller.ElapsedTime) * 100 | 0;

        console.log(`** Stopped PC=${Disassembly.Dump_WordValue(this._controller.Processor.PC)}`);

        // if (testSuiteOne) {
        //     let test: number = this._controller.Processor.GetByte(0x0210);
        //     if (test === 0xff) {
        //         console.log("** success!!");
        //     } else {
        //         console.log(`** ${Disassembly.Dump_WordValue(test)} failed!!`);
        //     }
        // }
        //
        // if (testSuiteTwo) {
        //     let test: number = this._controller.Processor.GetByte(0x0200);
        //     console.log(`**** Test=${Disassembly.Dump_ByteValue(test)}`);
        // }

        console.log(`Time taken ${seconds} seconds`);
        console.log(`Cycles per second ${cyclesPerSecond}`);
        console.log(`Speedup over ${this._configuration.Speed}Mhz 6502 ${speedup}`);

        console.log(`Simulated cycles used ${cycles}`);
        console.log(`Executing time ${executionSeconds} seconds`);
        console.log(`Execution proportion ${executionProportion}%`);

        console.log(`Simulated time taken ${simulatedElapsed}`);
    }
}
