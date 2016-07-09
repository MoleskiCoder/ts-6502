"use strict";

import * as FS from "fs";

export class ConfigurationReader {

    private _root: Object;

    constructor(path: string) {
        let contents: string = FS.readFileSync(path, "utf8");
        this._root = JSON.parse(contents);
    }

    protected get Root(): any { return this._root; }
}
