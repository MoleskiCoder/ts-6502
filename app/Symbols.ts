"use strict";

import * as FS from "fs";

export class Symbols {

    private _labels: any;
    private _constants: any;
    private _scopes: any;
    private _addresses: any;

    private _parsed: any;

    private static trimQuotes(input: string): string {
        return input.replace(/^"(.+(?="$))"$/, "$1");
    }

    constructor(path: string) {

        this._parsed = {};
        this._labels = {};
        this._constants = {};
        this._scopes = {};
        this._addresses = {};

        if (path.length > 0) {
            this.Parse(path);
            this.AssignSymbols();
            this.AssignScopes();
        }
    }

    public get Labels(): any { return this._labels; }
    public get Constants(): any { return this._constants; }
    public get Scopes(): any { return this._scopes; }
    public get Addresses(): any { return this._addresses; }

    private AssignScopes(): void {
        let parsedScopes: any = this._parsed.scope;
        for (let key in parsedScopes) {
            if (parsedScopes.hasOwnProperty(key)) {
                let parsedScope: any = parsedScopes[key];
                let name: string = Symbols.trimQuotes(parsedScope.name);
                let size: string = parsedScope.size;
                this._scopes[name] = parseInt(size, 10);
            }
        }
    }

    private AssignSymbols(): void {
        let symbols: any = this._parsed.sym;
        for (let key in symbols) {
            if (symbols.hasOwnProperty(key)) {
                let symbol: any = symbols[key];
                let name: string = Symbols.trimQuotes(symbol.name);
                let value: string = symbol.val;
                let parsedNumber: number = parseInt(value, 16);
                switch (symbol.type) {
                    case "lab":
                        this._labels[parsedNumber] = name;
                        this._addresses[name] = parsedNumber;
                        break;

                    case "equ":
                        this._constants[parsedNumber] = name;
                        break;

                    default:
                        // ignore unknown symbol types
                }
            }
        }
    }

    private Parse(path: string ): void {

        let contents: string = FS.readFileSync(path, "utf8");
        let lines: string[] = contents.split(/\n|\r\n/);

        for (let line of lines) {

            let lineElements: string[] = line.split(/\s/);
            if (lineElements.length === 2) {
                let type: string = lineElements[0];
                let dataElements: string[] = lineElements[1].split(",");
                let data: any = {};
                for (let dataElement of dataElements) {
                    let definition: string[] = dataElement.split("=");
                    if (definition.length === 2) {
                        data[definition[0]] = definition[1];
                    }
                }

                if (data.hasOwnProperty("id")) {
                    if (!this._parsed.hasOwnProperty(type)) {
                        this._parsed[type] = {};
                    }
                    let id: string = data.id;
                    delete data.id;
                    this._parsed[type][id] = data;
                }
            }
        }
    }
}
