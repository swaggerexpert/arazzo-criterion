import { assert } from 'chai';

import { test } from '../src/index.js';
import validConditions from './fixtures/conditions-valid.js';

describe('test', function () {
  it('should detect valid conditions', function () {
    validConditions.forEach((condition) => {
      assert.isTrue(test(condition), condition);
    });
  });

  it('should not detect invalid conditions', function () {
    assert.isFalse(test(''));
    assert.isFalse(test('=='));
    assert.isFalse(test('$statusCode =='));
    assert.isFalse(test('== 200'));
    assert.isFalse(test('$statusCode === 200'));
    assert.isFalse(test('$statusCode < 200 < 300')); // chained comparison rejected
    assert.isFalse(test('$statusCode == == 200'));
    assert.isFalse(test('($statusCode == 200'));
    assert.isFalse(test('nonsensical string'));
    assert.isFalse(test(1));
    assert.isFalse(test(null));
    assert.isFalse(test(undefined));
  });
});
