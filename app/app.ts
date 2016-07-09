"use strict";

import {Configuration} from "./Configuration";
import {Controller} from "./Controller";

let config: Configuration = new Configuration(".\\config\\sudoku.json", true);
let controller: Controller = new Controller(config);

controller.Configure();
controller.Start();

console.log("done!");
