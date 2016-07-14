"use strict";

import {Configuration} from "./Configuration";
import {Controller} from "./Controller";
import {Disassembly} from "./Disassembly";

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
        // let heldCycles: number = this._controller.Processor.HeldCycles;

        let start: number = this._controller.StartTime;
        let finish: number = this._controller.FinishTime;

        let elapsedTime: number = finish - start;
        let seconds: number = elapsedTime / 1000;
        let cyclesPerSecond: number = cycles / seconds;
        let simulatedElapsed: number = cycles / hertz;
        let speedup: number = cyclesPerSecond / hertz;

        // let cycleDifference: number = cycles - heldCycles;
        // let holdProportion: number = cycles / cycleDifference;

        // let hostHertz: number = this._configuration.HostSpeed * System6502.Mega;
        // let cyclesPerHostCycle: number = hostHertz / (cyclesPerSecond * holdProportion);

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
        // console.log(`Held cycles ${heldCycles}`);
        // console.log(`Held cycle difference ${cycleDifference}`);
        // console.log(`Held proportion ${holdProportion}`);
        //
        // console.log(`Cycles per host cycle (code efficiency!) ${cyclesPerHostCycle}`);

        console.log(`Simulated time taken ${simulatedElapsed}`);
    }
}
