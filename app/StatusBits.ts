"use strict";

export enum StatusBits {
    Negative = 0x80,
    Overflow = 0x40,
    Reserved = 0x20,
    Break = 0x10,
    Decimal = 0x08,
    Interrupt = 0x04,
    Zero = 0x02,
    Carry = 0x01,
}
