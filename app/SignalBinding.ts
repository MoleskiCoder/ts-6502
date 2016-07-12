/*
 *	@desc   	An object that represents a binding between a Signal and a listener function.
 *               Released under the MIT license
 *				http://millermedeiros.github.com/js-signals/
 *
 *	@version	1.0 - 7th March 2013
 *
 *	@author 	Richard Davey, TypeScript conversion
 *	@author		Miller Medeiros, JS Signals
 *	@author		Robert Penner, AS Signals
 *
 *	@url		http://www.kiwijs.org
 *
 */

import {Signal} from "./Signal";

export class SignalBinding {

    /**
     * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
     * @type Array|undefined
     */
    public params: Array<any> = undefined;

    /**
     * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @memberOf SignalBinding.prototype
     * @name context
     * @type Object|undefined|null
     */
    public context: Object;

    /**
     * Handler function bound to the signal.
     * @type Function
     * @private
     */
    private _listener: Function;

    /**
     * Reference to Signal object that listener is currently bound to.
     */
    private _signal: Signal;

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name SignalBinding
     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
     * @param {Function} listener Handler function bound to the signal.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent
     * the `this`
     * variable inside listener function).
     */
    constructor(signal: Signal, listener: Function, listenerContext: Object) {
        this._listener = listener;
        this.context = listenerContext;
        this._signal = signal;
    }

    /**
     * Call listener passing arbitrary parameters.
     * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue,
     * this method is used internally for the signal dispatch.</p>
     * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
     * @return {*} Value returned by the listener.
     */
    public execute(paramsArr?: any[]): any {
        let params: Array<any> = this.params ? this.params.concat(paramsArr) : paramsArr;
        return this._listener.apply(this.context, params);
    }

    /**
     * @return {Function} Handler function bound to the signal.
     */
    public getListener(): Function {
        return this._listener;
    }

    /**
     * @return {Signal} Signal that listener is currently bound to.
     */
    public getSignal(): Signal {
        return this._signal;
    }

    /**
     * Delete instance properties
     * @private
     */
    public _destroy(): void {
        delete this._signal;
        delete this._listener;
        delete this.context;
    }
}
