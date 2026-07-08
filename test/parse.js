import { assert } from 'chai';

import { parse } from '../src/index.js';

describe('parse', function () {
  context('given invalid condition string', function () {
    context('empty string', function () {
      specify('should fail parsing', function () {
        const { result, tree } = parse('');

        assert.isFalse(result.success);
        assert.isUndefined(tree);
      });
    });

    context('dangling operator', function () {
      specify('should fail parsing', function () {
        const { result, tree } = parse('$statusCode ==');

        assert.isFalse(result.success);
        assert.isUndefined(tree);
      });
    });

    context('nonsensical string', function () {
      specify('should fail parsing', function () {
        const { result, tree } = parse('nonsensical string');

        assert.isFalse(result.success);
        assert.isUndefined(tree);
      });
    });
  });

  context('given non-string input', function () {
    specify('should throw TypeError', function () {
      assert.throws(() => parse(1), TypeError, 'Criterion condition must be a string');
      assert.throws(() => parse(null), TypeError, 'Criterion condition must be a string');
      assert.throws(() => parse(undefined), TypeError, 'Criterion condition must be a string');
    });
  });
});
