"use strict";

import {Wrapper} from "./Wrapper";

let debug: boolean = false;

let sudoku: boolean = true;
let testSuiteOne: boolean = false;
let testSuiteTwo: boolean = false;
let ehbasic: boolean = false;
let bbc_forth: boolean = false;
let tali: boolean = false;

let wrapper: Wrapper;

if (sudoku) {
    wrapper = new Wrapper(".\\config\\sudoku.json", debug);
}

if (testSuiteOne) {
    wrapper = new Wrapper(".\\config\\test_suite_one.json", debug);
}

if (testSuiteTwo) {
    wrapper = new Wrapper(".\\config\\test_suite_two.json", debug);
}

if (ehbasic) {
    wrapper = new Wrapper(".\\config\\ehbasic.json", debug);
}

if (bbc_forth) {
    wrapper = new Wrapper(".\\config\\bbc_forth.json", debug);
}

if (tali) {
    wrapper = new Wrapper(".\\config\\tali.json", debug);
}

wrapper.Start();
