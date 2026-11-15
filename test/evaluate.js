import { promisify } from 'node:util';
import { assert } from 'chai';

import { evaluate, evaluateAsync, ArazzoCriterionEvaluateError } from '../src/index.js';

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

    specify('should coerce only strings in the JSON number format', function () {
      const values = {
        '$response.body#/exp': '1e3',
        '$response.body#/neg': '-0.5',
        '$response.body#/hex': '0x10',
        '$response.body#/bin': '0b11',
        '$response.body#/oct': '0o17',
        '$response.body#/padded': ' 42 ',
        '$response.body#/zero': '012',
        '$response.body#/plus': '+5',
      };
      const resolveValues = resolverFrom(values);

      assert.isTrue(evaluate('$response.body#/exp == 1000', { resolve: resolveValues }));
      assert.isTrue(evaluate('$response.body#/neg == -0.5', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/hex == 16', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/bin == 3', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/oct == 15', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/padded == 42', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/zero == 12', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/plus == 5', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/hex > 15', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/padded < 43', { resolve: resolveValues }));
    });

    specify('should treat arrays and objects as never equal', function () {
      const shared = [1, 2];
      const values = {
        '$response.body#/a': [1, 2],
        '$response.body#/b': [1, 2],
        '$response.body#/s1': shared,
        '$response.body#/s2': shared,
        '$response.body#/o': { a: 1 },
      };
      const resolveValues = resolverFrom(values);

      assert.isFalse(
        evaluate('$response.body#/a == $response.body#/b', { resolve: resolveValues }),
      );
      assert.isFalse(
        evaluate('$response.body#/a == $response.body#/a', { resolve: resolveValues }),
      );
      assert.isFalse(
        evaluate('$response.body#/s1 == $response.body#/s2', { resolve: resolveValues }),
      );
      assert.isFalse(
        evaluate('$response.body#/o == $response.body#/o', { resolve: resolveValues }),
      );
      assert.isFalse(evaluate("$response.body#/a == '1,2'", { resolve: resolveValues }));
      assert.isTrue(evaluate('$response.body#/a != $response.body#/a', { resolve: resolveValues }));
      assert.isTrue(evaluate('$response.body#/o != null', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/o == null', { resolve: resolveValues }));
    });

    specify('should treat functions as never equal', function () {
      const fn = () => 1;
      const resolveValues = resolverFrom({ '$response.body#/fn': fn });

      assert.isFalse(
        evaluate('$response.body#/fn == $response.body#/fn', { resolve: resolveValues }),
      );
      assert.isTrue(
        evaluate('$response.body#/fn != $response.body#/fn', { resolve: resolveValues }),
      );
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

    specify('should be false when comparing mismatched or structured types', function () {
      const values = {
        '$response.body#/t': true,
        '$response.body#/f': false,
        '$response.body#/empty': [],
        '$response.body#/arr': [1, 2],
        '$response.body#/obj': { a: 1 },
        '$response.body#/str': 'abc',
      };
      const resolveValues = resolverFrom(values);

      assert.isFalse(evaluate('$response.body#/t > 0', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/f < 1', { resolve: resolveValues }));
      assert.isFalse(
        evaluate('$response.body#/t >= $response.body#/f', { resolve: resolveValues }),
      );
      assert.isFalse(evaluate('$response.body#/empty < 1', { resolve: resolveValues }));
      assert.isFalse(
        evaluate('$response.body#/arr >= $response.body#/arr', { resolve: resolveValues }),
      );
      assert.isFalse(evaluate("$response.body#/obj < 'a'", { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/str > 5', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/str <= 5', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/t < $response.body#/t', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/t <= 1', { resolve: resolveValues }));
    });

    specify('should hold <= and >= for an equal pair that has no ordering', function () {
      const values = { '$response.body#/t': true, '$response.body#/f': false };
      const resolveValues = resolverFrom(values);

      assert.isTrue(evaluate('$response.body#/t <= true', { resolve: resolveValues }));
      assert.isTrue(evaluate('$response.body#/t >= $response.body#/t', { resolve: resolveValues }));
      assert.isTrue(evaluate('$response.body#/f >= false', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/t < true', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/t > true', { resolve: resolveValues }));
      assert.isFalse(evaluate('$response.body#/t >= false', { resolve: resolveValues }));
    });

    specify('should order and compare BigInts as numbers', function () {
      const values = { '$response.body#/big': 10n, '$response.body#/huge': 2n ** 64n };
      const resolveValues = resolverFrom(values);

      assert.isTrue(evaluate('$response.body#/big == 10', { resolve: resolveValues }));
      assert.isTrue(evaluate("$response.body#/big == '10'", { resolve: resolveValues }));
      assert.isTrue(evaluate('$response.body#/big < 11', { resolve: resolveValues }));
      assert.isTrue(evaluate('$response.body#/big >= 10', { resolve: resolveValues }));
      assert.isTrue(evaluate("$response.body#/big > '9'", { resolve: resolveValues }));
      assert.isTrue(
        evaluate('$response.body#/huge > 18446744073709550000', { resolve: resolveValues }),
      );
      assert.isFalse(evaluate('$response.body#/big != 10', { resolve: resolveValues }));
    });

    specify(
      'should still order numeric strings against numbers and strings against strings',
      function () {
        assert.isTrue(evaluate('$inputs.age > 29', { resolve }));
        assert.isTrue(evaluate("$inputs.name > 'abc'", { resolve }));
      },
    );
  });

  context('navigation', function () {
    specify('should read only own members of resolved values', function () {
      assert.isTrue(evaluate('$response.body.constructor == null', { resolve }));
      assert.isTrue(evaluate('$response.body.toString == null', { resolve }));
      assert.isTrue(evaluate('$response.body.data[0].hasOwnProperty == null', { resolve }));
      assert.isTrue(evaluate('$response.body.__proto__ == null', { resolve }));
      assert.isTrue(evaluate('$response.body.data.length == 1', { resolve }));
      assert.isTrue(evaluate('$response.body.status.length == 9', { resolve }));
    });

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
      const conditions = [
        '$statusCode == 200',
        '$statusCode',
        '!$statusCode',
        '$response.body.status',
        '200 == $statusCode',
        'true && $statusCode',
        'false || $statusCode',
      ];

      for (const condition of conditions) {
        assert.throws(
          () => evaluate(condition, { resolve: async () => 200 }),
          TypeError,
          /evaluateAsync/,
          condition,
        );
      }
    });

    specify('should not resolve a short-circuited operand', function () {
      assert.isFalse(evaluate('false && $statusCode', { resolve: async () => 200 }));
      assert.isTrue(evaluate('true || $statusCode', { resolve: async () => 200 }));
    });
  });

  context('given resolved values that are not Promises', function () {
    specify('should compare them as is, whatever properties they carry', function () {
      const values = {
        '$response.body': { then: () => 1 },
        '$request.body': {
          get then() {
            throw new Error('then must not be read');
          },
        },
        $url: { nested: { then() {} } },
      };
      const resolveValue = (expression) => values[expression];

      assert.isTrue(evaluate('$response.body != null', { resolve: resolveValue }));
      assert.isTrue(evaluate('$request.body != null', { resolve: resolveValue }));
      assert.isTrue(evaluate('$url.nested != null', { resolve: resolveValue }));
    });
  });

  specify('should be promisified to evaluateAsync', function () {
    assert.strictEqual(promisify(evaluate), evaluateAsync);
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
      '$statusCode <= 200',
      '$statusCode == 500 || $statusCode != 201',
      '$statusCode == 500 || $inputs.name == 500',
      '200 == $statusCode',
      '$statusCode == $inputs.name',
      '!($statusCode == 200 && $inputs.name)',
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

  specify('should resolve the right operand when the left one does not decide', async function () {
    const resolved = [];
    const tracking = async (expression) => {
      resolved.push(expression);
      return ctx[expression];
    };

    assert.isTrue(await evaluateAsync('$statusCode == 500 || $inputs.name', { resolve: tracking }));
    assert.isTrue(await evaluateAsync('$statusCode == 200 && $inputs.name', { resolve: tracking }));
    assert.deepEqual(resolved, ['$statusCode', '$inputs.name', '$statusCode', '$inputs.name']);
  });

  specify('should resolve comparison operands left to right', async function () {
    const resolved = [];
    const tracking = async (expression) => {
      resolved.push(expression);
      return ctx[expression];
    };

    await evaluateAsync('$inputs.name == $statusCode', { resolve: tracking });
    assert.deepEqual(resolved, ['$inputs.name', '$statusCode']);
  });

  specify('should await any thenable returned by resolve', async function () {
    const thenable = (value) => ({ then: (onFulfilled) => onFulfilled(value) });

    assert.isTrue(await evaluateAsync('$statusCode == 200', { resolve: () => thenable(200) }));
    assert.isTrue(
      await evaluateAsync("$response.body.status == 'available'", {
        resolve: (expression) => thenable(ctx[expression]),
      }),
    );
  });

  specify('should be what util.promisify(evaluate) returns', async function () {
    assert.isTrue(await promisify(evaluate)('$statusCode == 200', { resolve }));
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

  specify('should reject when a later operand rejects or throws', async function () {
    const failure = new Error('unavailable');
    const failing = (expression) => {
      if (expression === '$inputs.name') throw failure;
      return Promise.resolve(ctx[expression]);
    };
    const conditions = [
      '$statusCode == 200 && $inputs.name',
      '$statusCode == 500 || $inputs.name',
      '$statusCode == $inputs.name',
      '!$inputs.name',
    ];

    for (const condition of conditions) {
      assert.strictEqual(
        await rejection(evaluateAsync(condition, { resolve: failing })),
        failure,
        condition,
      );
    }
  });

  specify('should reject rather than throw on invalid input', async function () {
    const invalid = [
      [() => evaluateAsync({ type: 'BinaryExpression' }, { resolve }), TypeError],
      [() => evaluateAsync('$statusCode == 200'), TypeError, /evaluateAsync requires/],
      [() => evaluateAsync('== 200', { resolve }), ArazzoCriterionEvaluateError],
    ];

    for (const [call, ErrorClass, message] of invalid) {
      let promise;
      assert.doesNotThrow(() => {
        promise = call();
      });
      const error = await rejection(promise);
      assert.instanceOf(error, ErrorClass);
      if (message) assert.match(error.message, message);
    }
  });
});
