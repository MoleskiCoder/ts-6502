"use strict";

/**
 *	@desc       A TypeScript conversion of JS Signals by Miller Medeiros
 *               Released under the MIT license
 *				http://millermedeiros.github.com/js-signals/
 *
 *	@version	1.0 - 7th March 2013
 *
 *	@author 	Richard Davey, TypeScript conversion
 *	@author		Miller Medeiros, JS Signals
 *	@author		Robert Penner, AS Signals
 *
 *	@url		http://www.photonstorm.com
 */

import {SignalBinding} from "./SignalBinding";

/**
 * Custom event broadcaster
 * <br />- inspired by Robert Penner's AS3 Signals.
 * @name Signal
 * @author Miller Medeiros
 * @constructor
 */
export class Signal {

    /**
     * Signals Version Number
     * @property VERSION
     * @type String
     * @const
     */
    public static VERSION: string = "1.0.0";

    private _bindings: SignalBinding[] = [];

    /**
     * Add a listener to the signal.
     * @param {Function} listener Signal handler function.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent
     * the `this` variable inside listener function).
     * @return {SignalBinding} An Object representing the binding between the Signal and listener.
     */
    public add(listener: Function, listenerContext?: any): SignalBinding {
        return this._registerListener(listener, listenerContext);
    }

    /**
     * Remove all listeners from the Signal.
     */
    public removeAll(): void {

        let n: number = this._bindings.length;

        while (n--) {
            this._bindings[n]._destroy();
        }

        this._bindings.length = 0;
    }

    /**
     * @return {number} Number of listeners attached to the Signal.
     */
    public getNumListeners(): number {
        return this._bindings.length;
    }

    /**
     * Dispatch/Broadcast Signal to all listeners added to the queue.
     * @param {...*} [paramsArr] Parameters that should be passed to each handler.
     */
    public dispatch(...paramsArr: any[]): void {

        let n: number = this._bindings.length;
        if (n === 0) {
            return;
        }

        for (let i: number = 0; i < n; ++i) {
            this._bindings[i].execute(paramsArr);
        }
    }

    /**
     * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
     * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
     */
    public dispose(): void {
        this.removeAll();
        delete this._bindings;
    }

    private _registerListener(listener: Function, listenerContext: Object): SignalBinding {
        let binding: SignalBinding = new SignalBinding(this, listener, listenerContext);
        this._bindings.push(binding);
        return binding;
    }
}
