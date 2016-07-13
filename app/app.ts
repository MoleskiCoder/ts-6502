"use strict";

import {Wrapper} from "./Wrapper";

let debug: boolean = false;

let sudoku: boolean = true;
let testSuiteOne: boolean = false;
let testSuiteTwo: boolean = false;

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

wrapper.Start();
