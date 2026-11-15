import parse from '../parse/index.js';
import ArazzoCriterionEvaluateError from '../errors/ArazzoCriterionEvaluateError.js';

/**
 * Evaluate a "simple" Arazzo criterion condition.
 *
 * Runtime expression values are supplied by the caller through `resolve`, which
 * receives the runtime expression string and its parsed sub-AST, and returns the
 * concrete value.
 *
 * `resolve` must return the value itself: a `resolve` returning a native Promise
 * (e.g. an `async` function) makes `evaluate` throw a `TypeError` rather than
 * compare the Promise object. Use `evaluateAsync` when values are only available
 * asynchronously.
 *
 * @example
 * evaluate('$statusCode == 200', {
 *   resolve: (expression, ast) => (expression === '$statusCode' ? 200 : undefined),
 * }); // => true
 */
const evaluate = (condition, { resolve } = {}) => {
  const tree = prepare(condition, resolve, 'evaluate');
  return toBoolean(evaluateNode(tree, syncMode(resolve)));
};

/**
 * Evaluate a "simple" Arazzo criterion condition whose runtime expression values
 * may only be available asynchronously.
 *
 * Same semantics as `evaluate`, except that `resolve` may return the value or a
 * Promise (any thenable) of it, and the result is always a Promise of a boolean.
 * Only values returned by `resolve` are awaited; data reached by navigation is
 * compared as is. Every failure
 * (invalid input, an unparseable condition, a `resolve` that throws or rejects)
 * rejects the returned Promise. `&&` and `||` still short-circuit: the right
 * operand is resolved only after the left one has settled without deciding the
 * result.
 *
 * @example
 * await evaluateAsync('$statusCode == 200', {
 *   resolve: async (expression, ast) => (expression === '$statusCode' ? 200 : undefined),
 * }); // => true
 */
export const evaluateAsync = async (condition, { resolve } = {}) => {
  const tree = prepare(condition, resolve, 'evaluateAsync');
  const result = asyncStep(evaluateNode(tree, asyncMode(resolve)), toBoolean);
  return result instanceof Pending ? (await result.promise).value : result;
};

// util.promisify(evaluate) returns evaluateAsync; Symbol.for keeps this free of node:util.
evaluate[Symbol.for('nodejs.util.promisify.custom')] = evaluateAsync;

const prepare = (condition, resolve, name) => {
  if (typeof condition !== 'string') {
    throw new TypeError('Criterion condition must be a string');
  }
  if (typeof resolve !== 'function') {
    throw new TypeError(`${name} requires a "resolve" function in options`);
  }

  const { result, tree } = parse(condition);
  if (!result.success) {
    throw new ArazzoCriterionEvaluateError('Invalid criterion condition', { condition });
  }
  return tree;
};

const isThenable = (value) =>
  value !== null &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof value.then === 'function';

/*
 * The evaluator is written once and runs in a mode: how `resolve` is called and
 * how each operand is passed on (`step(value, continuation)`). Only values
 * returned by `resolve` are ever inspected — data reached by navigation is
 * compared as is in both modes, whatever properties it carries.
 */

// sync: `resolve` must hand the value back. A native Promise means an async
// resolver, which would otherwise be compared as a plain object.
const syncMode = (resolve) => ({
  resolve: (expression, ast) => {
    const value = resolve(expression, ast);
    if (value instanceof Promise) {
      throw new TypeError('resolve returned a Promise; use evaluateAsync to await resolved values');
    }
    return value;
  },
  step: (value, continuation) => continuation(value),
});

// async: a pending operand is a Pending, never a bare Promise, so a settled
// value is never adopted as a thenable on its way through the chain.
class Pending {
  constructor(promise) {
    this.promise = promise; // resolves to { value }
  }
}

const settle = (result) => (result instanceof Pending ? result.promise : { value: result });

const asyncStep = (value, continuation) =>
  value instanceof Pending
    ? new Pending(value.promise.then(({ value: settled }) => settle(continuation(settled))))
    : continuation(value);

const asyncMode = (resolve) => ({
  resolve: (expression, ast) => {
    const value = resolve(expression, ast);
    return isThenable(value)
      ? new Pending(Promise.resolve(value).then((settled) => ({ value: settled })))
      : value;
  },
  step: asyncStep,
});

const evaluateNode = (node, mode) => {
  switch (node.type) {
    case 'LogicalExpression':
      return evaluateLogical(node, mode);
    case 'UnaryExpression':
      return mode.step(evaluateNode(node.argument, mode), (value) => !toBoolean(value));
    case 'BinaryExpression':
      return evaluateComparison(node, mode);
    case 'Literal':
      return node.value;
    case 'RuntimeExpression':
      return mode.resolve(node.text, node.expression);
    case 'RuntimeExpressionNavigation':
      return evaluateNavigation(node, mode);
    default:
      throw new ArazzoCriterionEvaluateError(`Unknown AST node type: ${node.type}`);
  }
};

const evaluateLogical = (node, mode) =>
  mode.step(evaluateNode(node.left, mode), (left) => {
    const decided = node.operator === '&&' ? !toBoolean(left) : toBoolean(left);
    if (decided) return toBoolean(left);
    return mode.step(evaluateNode(node.right, mode), toBoolean);
  });

const evaluateNavigation = (node, mode) =>
  mode.step(mode.resolve(node.expression.text, node.expression.expression), (resolved) => {
    let value = resolved;
    for (const accessor of node.navigation) {
      if (value == null) return undefined;
      value = accessor.type === 'MemberAccess' ? value[accessor.name] : value[accessor.value];
    }
    return value;
  });

const evaluateComparison = (node, mode) =>
  mode.step(evaluateNode(node.left, mode), (left) =>
    mode.step(evaluateNode(node.right, mode), (right) => compare(node.operator, left, right)),
  );

const compare = (operator, left, right) => {
  switch (operator) {
    case '==':
      return looseEquals(left, right);
    case '!=':
      return !looseEquals(left, right);
    case '<':
    case '<=':
    case '>':
    case '>=':
      return relational(operator, left, right);
    default:
      throw new ArazzoCriterionEvaluateError(`Unknown comparison operator: ${operator}`);
  }
};

// null equals only itself; comparing null to any other value is false.
const looseEquals = (a, b) => {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull || bNull) return aNull && bNull;

  // string comparisons MUST be case insensitive
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase() === b.toLowerCase();
  }

  // numeric strings SHOULD be coerced to numbers when compared with a number
  if (typeof a === 'number' && typeof b === 'string' && isNumeric(b)) return a === Number(b);
  if (typeof b === 'number' && typeof a === 'string' && isNumeric(a)) return Number(a) === b;

  return a === b;
};

const relational = (operator, a, b) => {
  // comparing null/undefined with a relational operator is always false
  if (a === null || a === undefined || b === null || b === undefined) return false;

  let left = a;
  let right = b;

  // numeric coercion of numeric strings under numeric operators
  if (typeof left === 'number' && typeof right === 'string' && isNumeric(right))
    right = Number(right);
  else if (typeof right === 'number' && typeof left === 'string' && isNumeric(left))
    left = Number(left);
  else if (typeof left === 'string' && typeof right === 'string') {
    // case-insensitive string ordering
    left = left.toLowerCase();
    right = right.toLowerCase();
  }

  switch (operator) {
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    default:
      return false;
  }
};

const isNumeric = (str) => str.trim() !== '' && Number.isFinite(Number(str));

// A condition passes (truthy) when it evaluates to a truthy value; it fails (falsy)
// on false, null, or a missing (undefined) value.
const toBoolean = (value) => Boolean(value);

export default evaluate;
