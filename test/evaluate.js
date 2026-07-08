import { assert } from 'chai';

import { evaluate } from '../src/index.js';

/**
 * A resolver backed by a plain map keyed on the runtime expression string.
 */
const resolverFrom = (context) => (expression) => context[expression];

describe('evaluate', function () {
  const ctx = {
    $statusCode: 200,
    '$response.body': { status: 'Available', data: [{ id: 42 }], count: 0, active: false },
    '$inputs.name': 'Fluffy',
    '$inputs.age': '30',
  };
  const resolve = resolverFrom(ctx);

  context('equality', function () {
    specify('should compare numbers', function () {
      assert.isTrue(evaluate('$statusCode == 200', { resolve }));
      assert.isFalse(evaluate('$statusCode == 201', { resolve }));
      assert.isTrue(evaluate('$statusCode != 201', { resolve }));
    });

    specify('should compare strings case-insensitively', function () {
      assert.isTrue(evaluate("$response.body.status == 'available'", { resolve }));
      assert.isTrue(evaluate("$inputs.name == 'FLUFFY'", { resolve }));
      assert.isFalse(evaluate("$inputs.name == 'rex'", { resolve }));
    });

    specify('should coerce numeric strings', function () {
      assert.isTrue(evaluate("$statusCode == '200'", { resolve }));
      assert.isTrue(evaluate('$inputs.age == 30', { resolve }));
    });

    specify('should treat null as equal only to null', function () {
      assert.isTrue(evaluate('$response.body.missing == null', { resolve }));
      assert.isFalse(evaluate('$statusCode == null', { resolve }));
      assert.isTrue(evaluate('$response.body.data != null', { resolve }));
    });
  });

  context('relational', function () {
    specify('should compare numbers', function () {
      assert.isTrue(evaluate('$statusCode >= 200 && $statusCode < 300', { resolve }));
      assert.isTrue(evaluate('$statusCode > 199', { resolve }));
      assert.isFalse(evaluate('$statusCode < 200', { resolve }));
    });

    specify('should be false when comparing null relationally', function () {
      assert.isFalse(evaluate('$response.body.missing > 0', { resolve }));
    });
  });

  context('navigation', function () {
    specify('should dereference members and indices', function () {
      assert.isTrue(evaluate('$response.body.data[0].id > 10', { resolve }));
      assert.isTrue(evaluate('$response.body.data[0].id == 42', { resolve }));
      assert.isTrue(evaluate('$response.body.count == 0', { resolve }));
    });

    specify('should yield falsy for missing path segments', function () {
      assert.isFalse(evaluate('$response.body.nope.deep', { resolve }));
    });
  });

  context('logical composition', function () {
    specify('should evaluate &&, ||, !, and grouping', function () {
      assert.isTrue(evaluate('$statusCode == 200 && $response.body.data != null', { resolve }));
      assert.isTrue(evaluate('$statusCode == 500 || $statusCode == 200', { resolve }));
      assert.isTrue(evaluate('!$response.body.active', { resolve }));
      assert.isFalse(evaluate('!($statusCode == 200)', { resolve }));
      assert.isTrue(
        evaluate('($statusCode == 200 || $statusCode == 201) && $response.body != null', {
          resolve,
        }),
      );
    });
  });

  context('bare truthiness', function () {
    specify('should treat a value as pass/fail', function () {
      assert.isTrue(evaluate('true', { resolve }));
      assert.isFalse(evaluate('false', { resolve }));
      assert.isFalse(evaluate('null', { resolve }));
      assert.isTrue(evaluate('$statusCode', { resolve }));
      assert.isFalse(evaluate('$response.body.active', { resolve }));
    });
  });

  context('given invalid input', function () {
    specify('should throw for a non-string condition', function () {
      assert.throws(() => evaluate({ type: 'BinaryExpression' }, { resolve }), TypeError);
    });

    specify('should throw without a resolve function', function () {
      assert.throws(() => evaluate('$statusCode == 200'), TypeError);
    });

    specify('should throw for an unparseable condition string', function () {
      assert.throws(() => evaluate('== 200', { resolve }));
    });
  });
});
