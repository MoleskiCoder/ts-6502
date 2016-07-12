"use strict";

import {Configuration} from "./Configuration";
import {Controller} from "./Controller";
import {System6502} from "./System6502";
import {Disassembly} from "./Disassembly";

let debug: boolean = false;

// let sudoku: boolean = false;
let sudoku: boolean = true;
let testSuiteOne: boolean = false;
// let testSuiteOne: boolean = true;
let testSuiteTwo: boolean = false;
// let testSuiteTwo: boolean = true;

let config: Configuration;

if (sudoku) {
    config = new Configuration(".\\config\\sudoku.json", debug);
}

if (testSuiteOne) {
    config = new Configuration(".\\config\\test_suite_one.json", debug);
}

if (testSuiteTwo) {
    config = new Configuration(".\\config\\test_suite_two.json", debug);
}

let controller: Controller = new Controller(config);

controller.Configure();
controller.Start();

let hertz: number = config.Speed * System6502.Mega;

let cycles: number = controller.Processor.Cycles;
let heldCycles: number = controller.Processor.HeldCycles;

let start: number = controller.StartTime;
let finish: number = controller.FinishTime;

let elapsedTime: number = finish - start;
let seconds: number = elapsedTime / 1000;
let cyclesPerSecond: number = cycles / seconds;
let simulatedElapsed: number = cycles / hertz;
let speedup: number = cyclesPerSecond / hertz;

let cycleDifference: number = cycles - heldCycles;
let holdProportion: number = cycles / cycleDifference;

let hostHertz: number = config.HostSpeed * System6502.Mega;
let cyclesPerHostCycle: number = hostHertz / (cyclesPerSecond * holdProportion);

console.log(`** Stopped PC=${Disassembly.Dump_WordValue(controller.Processor.PC)}`);

if (testSuiteOne) {
    let test: number = controller.Processor.GetByte(0x0210);
    if (test === 0xff) {
        console.log("** success!!");
    } else {
        console.log(`** ${Disassembly.Dump_WordValue(test)} failed!!`);
    }
}

if (testSuiteTwo) {
    let test: number = controller.Processor.GetByte(0x0200);
    console.log(`**** Test=${Disassembly.Dump_ByteValue(test)}`);
}

console.log(`Time taken ${seconds} seconds`);
console.log(`Cycles per second ${cyclesPerSecond}`);
console.log(`Speedup over ${config.Speed}Mhz 6502 ${speedup}`);

console.log(`Simulated cycles used ${cycles}`);
console.log(`Held cycles ${heldCycles}`);
console.log(`Held cycle difference ${cycleDifference}`);
console.log(`Held proportion ${holdProportion}`);

console.log(`Cycles per host cycle (code efficiency!) ${cyclesPerHostCycle}`);

console.log(`Simulated time taken ${simulatedElapsed}`);
