import * as fs from 'node:fs';
import { assert } from 'chai';

import { Grammar } from '../src/index.js';

describe('SABNF', function () {
  it('should export Grammar', function () {
    assert.isFunction(Grammar);
  });

  it('should convert to string', function () {
    const abnf = fs.readFileSync(new URL('../src/grammar.bnf', import.meta.url)).toString();
    const grammar = new Grammar();

    assert.strictEqual(abnf, grammar.toString());
  });
});
