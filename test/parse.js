import { assert } from 'chai';

import { parse, CSTTranslator } from '../src/index.js';

describe('parse', function () {
  context('given invalid condition string', function () {
    context('operand that is not a valid runtime expression', function () {
      const translators = [
        ['ASTTranslator (default)', () => ({})],
        ['CSTTranslator', () => ({ translator: new CSTTranslator() })],
        ['no translator', () => ({ translator: null })],
      ];

      translators.forEach(([name, options]) => {
        specify(`should fail parsing with ${name}`, function () {
          [
            '$x == 1',
            '$nonsense',
            '$response.body.a. == 1',
            '$statusCode == 200 && $nonsense',
          ].forEach((condition) => {
            const { result, tree } = parse(condition, options());

            assert.isFalse(result.success, condition);
            assert.isUndefined(tree, condition);
          });
        });

        specify(`should parse valid operands with ${name}`, function () {
          const { result } = parse('$response.body.data[0].id > 10 || $inputs.flag', options());

          assert.isTrue(result.success);
        });
      });
    });

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
