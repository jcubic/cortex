import { expect, test } from 'vitest';

import * as acorn from 'acorn';
import Interpreter from '../interpreter';

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
