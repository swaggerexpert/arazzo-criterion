import { assert } from 'chai';

import { evaluate, evaluateAsync } from '../src/index.js';

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

    specify('should throw when resolve returns a Promise', function () {
      assert.throws(
        () => evaluate('$statusCode == 200', { resolve: async () => 200 }),
        TypeError,
        /evaluateAsync/,
      );
    });
  });
});

describe('evaluateAsync', function () {
  const ctx = {
    $statusCode: 200,
    '$response.body': { status: 'Available', data: [{ id: 42 }], count: 0, active: false },
    '$inputs.name': 'Fluffy',
  };
  const resolve = async (expression) => ctx[expression];

  const rejection = async (promise) => {
    try {
      await promise;
    } catch (error) {
      return error;
    }
    return assert.fail('expected the promise to reject');
  };

  specify('should return a Promise of a boolean', async function () {
    const result = evaluateAsync('$statusCode == 200', { resolve });

    assert.instanceOf(result, Promise);
    assert.isTrue(await result);
  });

  specify('should apply the same semantics as evaluate', async function () {
    const conditions = [
      "$response.body.status == 'available'",
      '$statusCode >= 200 && $statusCode < 300',
      '$response.body.data[0].id == 42',
      '$response.body.nope.deep',
      '!$response.body.active',
      '($statusCode == 200 || $statusCode == 201) && $response.body != null',
      '$response.body.missing > 0',
      'null',
    ];
    const syncResolve = (expression) => ctx[expression];

    for (const condition of conditions) {
      assert.strictEqual(
        await evaluateAsync(condition, { resolve }),
        evaluate(condition, { resolve: syncResolve }),
        condition,
      );
    }
  });

  specify('should accept a resolve mixing values and Promises', async function () {
    const mixed = (expression) =>
      expression === '$statusCode' ? 200 : Promise.resolve(ctx[expression]);

    assert.isTrue(
      await evaluateAsync("$statusCode == 200 && $inputs.name == 'fluffy'", { resolve: mixed }),
    );
  });

  specify('should short-circuit && and ||', async function () {
    const resolved = [];
    const tracking = async (expression) => {
      resolved.push(expression);
      return ctx[expression];
    };

    assert.isFalse(
      await evaluateAsync('$statusCode == 500 && $inputs.name', { resolve: tracking }),
    );
    assert.isTrue(await evaluateAsync('$statusCode == 200 || $inputs.name', { resolve: tracking }));
    assert.deepEqual(resolved, ['$statusCode', '$statusCode']);
  });

  specify('should reject when resolve rejects', async function () {
    const failure = new Error('unavailable');
    const error = await rejection(
      evaluateAsync('$statusCode == 200', { resolve: () => Promise.reject(failure) }),
    );

    assert.strictEqual(error, failure);
  });

  specify('should reject when resolve throws', async function () {
    const failure = new Error('unavailable');
    const error = await rejection(
      evaluateAsync('$statusCode == 200', {
        resolve: () => {
          throw failure;
        },
      }),
    );

    assert.strictEqual(error, failure);
  });

  specify('should reject rather than throw on invalid input', async function () {
    const invalid = [
      () => evaluateAsync({ type: 'BinaryExpression' }, { resolve }),
      () => evaluateAsync('$statusCode == 200'),
      () => evaluateAsync('== 200', { resolve }),
    ];

    for (const call of invalid) {
      let promise;
      assert.doesNotThrow(() => {
        promise = call();
      });
      assert.instanceOf(await rejection(promise), Error);
    }
  });
});
