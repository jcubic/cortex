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

test('it should check if value is an arrray', () => {
    ['Array(1,2,3)', 'new Array(1,2,3)', '[1,2,3]'].forEach(arr => {
        const fn = vi.fn();
        const code = `var arr = ${arr}; alert(Array.isArray(arr));`;
        const inter = new Interpreter(code, (interpreter, globalObject) => {
            const native_fn = interpreter.createNativeFunction(fn);
            interpreter.setProperty(globalObject, 'alert', native_fn);
        });
        inter.run();
        expect(fn.mock.calls[0]).toEqual([true]);
    });
});

test('it should check if value is not an arrray', () => {
    ['true', 'false', '10', '"hello"', '0.1'].forEach(value => {
        const fn = vi.fn();
        const code = `var value = ${value}; alert(Array.isArray(value));`;
        const inter = new Interpreter(code, (interpreter, globalObject) => {
            const native_fn = interpreter.createNativeFunction(fn);
            interpreter.setProperty(globalObject, 'alert', native_fn);
        });
        inter.run();
        expect(fn.mock.calls[0]).toEqual([false]);
    });
});

test('it should convert internal array to native array', () => {
    ['Array(1,2,3)', 'new Array(1,2,3)', '[1,2,3]'].forEach(arr => {
        const fn = vi.fn();
        const code = `var arr = ${arr}; alert(arr);`;
        const inter = new Interpreter(code, (interpreter, globalObject) => {
            const native_fn = interpreter.createNativeFunction(fn);
            interpreter.setProperty(globalObject, 'alert', native_fn);
        });
        inter.run();
        expect(inter.pseudoToNative(fn.mock.calls[0][0])).toEqual([1,2,3]);
    });
});

test('it should return object fields and methods', () => {
    const fn = vi.fn();
    const code = `function Foo(bar) {
                    this.bar = bar;
                    this.getValue = function() {
                      return this.bar.toUpperCase();
                    };
                  }
                  Foo.prototype.getBar = function() {
                     return this.bar;
                  };
                  var foo = new Foo();
                  alert(Object.getOwnPropertyNames(foo));`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(inter.pseudoToNative(fn.mock.calls[0][0])).toEqual(['bar', 'getValue']);
});

test('it should throw when getting own Properties on invalid value', () => {
    ['undefined', 'null'].forEach(value => {
        const code = `var value = ${value};
                      Object.getOwnPropertyNames(value)`;
        const inter = new Interpreter(code);
        expect(() => inter.run()).toThrow(/convert/);
    });
});

test('it should create object with prototype using Object.create', () => {
    const fn = vi.fn();
    const code = `var x = Object.create(Object);
                  alert(x);
                  alert(x.toString());`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(inter.pseudoToNative(fn.mock.calls[0][0])).toEqual({});
    expect(fn.mock.calls[1][0]).toEqual('[object Object]');
});

test('it should create object with prototype null', () => {
    const fn = vi.fn();
    const code = `var x = Object.create(null);
                  alert(x.toString());`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    expect(() => inter.run()).toThrow(/toString/);
});

test('it should create object with Object constructor', () => {
    ['Object()', 'new Object()'].forEach(obj => {
        const code = `var obj = ${obj}; obj.foo = 'lorem'; obj;`;
        const inter = new Interpreter(code);
        inter.run();
        expect(inter.pseudoToNative(inter.value)).toEqual({foo: 'lorem'});
    });
});

test('it should box primitive value when using Object constructor', () => {
    const fn = vi.fn();
    const code = `var obj = Object(10); alert(obj + 2);`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(fn.mock.calls[0]).toEqual([12]);
});

test('it should convert boxed Object into native value', () => {
    const code = `var obj = Object(10); obj`;
    const inter = new Interpreter(code);
    inter.run();
    expect(inter.pseudoToNative(inter.value)).toEqual(new Number(10));
});

test('it should convert RegExp to native value', () => {
    ['new RegExp("foo")', '/foo/'].forEach(re => {
        const code = `var obj = ${re}; obj`;
        const inter = new Interpreter(code);
        inter.run();
        console.log(inter.value);
        expect(inter.pseudoToNative(inter.value)).toEqual(/foo/);
    });
});

test('it should convert Date object to native value', () => {
    const code = `var obj = new Date('2024'); obj`;
    const inter = new Interpreter(code);
    inter.run();
    console.log(inter.value);
    expect(inter.pseudoToNative(inter.value)).toEqual(new Date('2024'));
});

test('it should throw when using Object.create with invalid value', () => {
    const fn = vi.fn();
    const code = `var x = Object.create("hello");`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    expect(() => inter.run()).toThrow(/Object or null/);
});

test('it should create object property', () => {
    const fn = vi.fn();
    const code = `var foo = {};
                  Object.defineProperty(foo, 'bar', { value: 20 });
                  alert(foo.bar)`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(fn.mock.calls[0]).toEqual([20]);
});

test('it should create object property', () => {
    const fn = vi.fn();
    const code = 'var foo = {}; Object.defineProperty(foo, "bar", { value: 20 }); alert(foo.bar)';
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(fn.mock.calls[0]).toEqual([20]);
});

test('it should mutate object property', () => {
    const fn = vi.fn();
    const code = `var foo = {};
                  Object.defineProperty(foo, "bar", { value: 20, writable: true });
                  foo.bar = 30;
                  alert(foo.bar)`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(fn.mock.calls[0]).toEqual([30]);
});


test('it should not allow mutating of property', () => {
    const fn = vi.fn();
    const code = `var foo = {};
                  Object.defineProperty(foo, "bar", { value: 20 });
                  foo.bar = 30;
                  alert(foo.bar)`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(fn.mock.calls[0]).toEqual([20]);
});

test('it should create enumerable property', () => {
    const fn = vi.fn();
    const code = `var foo = {};
                  Object.defineProperty(foo, "bar", { value: 20, enumerable: true });
                  alert(Object.keys(foo))`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(Object.values(fn.mock.calls[0][0].properties)).toEqual(['bar']);
});

test('it should allow to reconfigure a property', () => {
    const fn = vi.fn();
    const code = `var foo = {};
                  Object.defineProperty(foo, "bar", { value: 20, configurable: true });
                  Object.defineProperty(foo, "bar", { value: 30, enumerable: true });
                  var values = Object.keys(foo).map(function(e) {
                    return foo[e];
                  });
                  alert(values)`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    inter.run();
    expect(Object.values(fn.mock.calls[0][0].properties)).toEqual([30]);
});

test('it should create non configurable property', () => {
    const fn = vi.fn();
    const code = `var foo = {};
                  Object.defineProperty(foo, "bar", { value: 20 });
                  Object.defineProperty(foo, "bar", { value: 30 });
                  alert(Object.values(foo))`;
    const inter = new Interpreter(code, (interpreter, globalObject) => {
        const native_fn = interpreter.createNativeFunction(fn);
        interpreter.setProperty(globalObject, 'alert', native_fn);
    });
    expect(() => inter.run()).toThrow(/redefine/);
});
