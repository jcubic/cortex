import { expect, test, vi } from 'vitest';

import * as acorn from 'acorn';
import Interpreter from '../interpreter';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

Interpreter.nativeGlobal.acorn = acorn;

{
    const code = 'var a=1; for(var i=1;i<10;i++) { a*=i; } a;';

    test('it should step through the code', () => {
        const inter = new Interpreter(code);
        while (inter.step()) { }
        expect(inter.value).toBe(362880);
    });

    test('it should evalute code', () => {
        const inter = new Interpreter(code);
        inter.run();
        expect(inter.value).toBe(362880);
    });

    test('it should pause after running code', () => {
        const inter = new Interpreter(code);
        expect(inter.run()).toBe(false);
    });
}

test('it should create external function', () => {
    const fn = vi.fn();
    const args = ['hello', 'world'];
    const code = `alert.apply(null, ${JSON.stringify(args)});`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(fn.mock.calls[0]).toEqual(['hello', 'world']);
});

test('it should create object and method', () => {
    const fn = vi.fn();
    const code = 'console.log("hello, world!")';
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const console = interpreter.nativeToPseudo({});
        interpreter.setProperty(globalObject, 'console', console);
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(console, 'log', native_fn);
    });
    inter.run();
    expect(fn.mock.calls[0]).toEqual(['hello, world!']);
});

test('it should create and evaluate async task', async () => {
    const code = 'setTimeout(function() { alert("hello"); }, 0)';
    const fn = vi.fn();
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    (async () => {
        while (inter.step()) {
            await Promise.resolve();
        }
    })();
    expect(fn.mock.calls.length).toEqual(0);
    await delay(10);
    expect(fn.mock.calls[0]).toEqual(['hello']);
});

test('it should create and interate over array', () => {
    const fn = vi.fn();
    const code = 'var x = [1,2,3]; for (var i in x) { alert(i, x[i]); }';
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(fn.mock.calls).toEqual([['0', 1], ['1', 2], ['2', 3]]);
});

test('it should create array using Array function', () => {
    ['Array(1,2,3)', 'new Array(1,2,3)'].forEach(arr => {
        const fn = vi.fn();
        const code = `var x = ${arr}; for (var i in x) { alert(i, x[i]); }`;
        const inter = new Interpreter(code, (interpreter, globalObject) => {
            const native_fn = interpreter.createNativeFunction(fn);
            interpreter.setProperty(globalObject, 'alert', native_fn);
        });
        inter.run();
        expect(fn.mock.calls).toEqual([['0', 1], ['1', 2], ['2', 3]]);
    });
});

test('it should create array using Array function with given length', () => {
    const fn = vi.fn();
    const len = 10;
    const code = `var arr = Array(${len}); alert(arr.length);`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(fn.mock.calls[0]).toEqual([len]);
});

test('it not should create array using Array function with invalid length', () => {
    const code = `var arr = Array(-1);`;
    const inter = new Interpreter(code);
    expect(() => inter.run()).toThrowError('-1');
});

test('it should append code', () => {
    const fn = vi.fn();
    const code = `alert(1);`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.appendCode('alert(2);');
    inter.run();
    expect(fn.mock.calls).toEqual([[1], [2]]);
});

