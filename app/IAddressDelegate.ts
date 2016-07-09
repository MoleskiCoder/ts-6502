"use strict";

import {AddressEventArgs} from "./AddressEventArgs";

export interface IAddressDelegate {
    (e: AddressEventArgs): void;
}
