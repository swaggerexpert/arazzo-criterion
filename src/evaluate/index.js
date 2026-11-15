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
  return toBoolean(evaluateNode(tree, resolve));
};

/**
 * Evaluate a "simple" Arazzo criterion condition whose runtime expression values
 * may only be available asynchronously.
 *
 * Same semantics as `evaluate`, except that `resolve` may return the value or a
 * Promise of it, which is awaited, and the result is always a Promise of a
 * boolean. Every failure (invalid input, an unparseable condition, a `resolve`
 * that throws or rejects) rejects the returned Promise. `&&` and `||` still
 * short-circuit: the right operand is resolved only after the left one has
 * settled without deciding the result.
 *
 * @example
 * await evaluateAsync('$statusCode == 200', {
 *   resolve: async (expression, ast) => (expression === '$statusCode' ? 200 : undefined),
 * }); // => true
 */
export const evaluateAsync = async (condition, { resolve } = {}) => {
  const tree = prepare(condition, resolve, 'evaluateAsync');
  return toBoolean(await evaluateNodeAsync(tree, resolve));
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

// a native Promise means an async resolver, whose Promise would otherwise be
// compared as a plain object.
const resolveValue = (resolve, expression, ast) => {
  const value = resolve(expression, ast);
  if (value instanceof Promise) {
    throw new TypeError('resolve returned a Promise; use evaluateAsync to await resolved values');
  }
  return value;
};

const evaluateNode = (node, resolve) => {
  switch (node.type) {
    case 'LogicalExpression':
      return evaluateLogical(node, resolve);
    case 'UnaryExpression':
      return !toBoolean(evaluateNode(node.argument, resolve));
    case 'BinaryExpression':
      return compare(
        node.operator,
        evaluateNode(node.left, resolve),
        evaluateNode(node.right, resolve),
      );
    case 'Literal':
      return node.value;
    case 'RuntimeExpression':
      return resolveValue(resolve, node.text, node.expression);
    case 'RuntimeExpressionNavigation':
      return navigate(
        resolveValue(resolve, node.expression.text, node.expression.expression),
        node.navigation,
      );
    default:
      throw new ArazzoCriterionEvaluateError(`Unknown AST node type: ${node.type}`);
  }
};

const evaluateLogical = (node, resolve) => {
  if (node.operator === '&&') {
    return (
      toBoolean(evaluateNode(node.left, resolve)) && toBoolean(evaluateNode(node.right, resolve))
    );
  }
  // '||'
  return (
    toBoolean(evaluateNode(node.left, resolve)) || toBoolean(evaluateNode(node.right, resolve))
  );
};

// the async counterpart of evaluateNode: same cases, each operand awaited in turn
const evaluateNodeAsync = async (node, resolve) => {
  switch (node.type) {
    case 'LogicalExpression':
      return evaluateLogicalAsync(node, resolve);
    case 'UnaryExpression':
      return !toBoolean(await evaluateNodeAsync(node.argument, resolve));
    case 'BinaryExpression': {
      const left = await evaluateNodeAsync(node.left, resolve);
      return compare(node.operator, left, await evaluateNodeAsync(node.right, resolve));
    }
    case 'Literal':
      return node.value;
    case 'RuntimeExpression':
      return resolve(node.text, node.expression);
    case 'RuntimeExpressionNavigation':
      return navigate(
        await resolve(node.expression.text, node.expression.expression),
        node.navigation,
      );
    default:
      throw new ArazzoCriterionEvaluateError(`Unknown AST node type: ${node.type}`);
  }
};

const evaluateLogicalAsync = async (node, resolve) => {
  const left = toBoolean(await evaluateNodeAsync(node.left, resolve));
  // the right operand is evaluated only when the left one does not decide the result
  if (node.operator === '&&' ? !left : left) return left;
  return toBoolean(await evaluateNodeAsync(node.right, resolve));
};

const navigate = (resolved, navigation) => {
  let value = resolved;
  for (const step of navigation) {
    if (value == null) return undefined;
    const key = step.type === 'MemberAccess' ? step.name : step.value;
    // only the value's own members: `.constructor` or `.toString` must not reach the prototype
    value = Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
  }
  return value;
};

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

  // only JSON scalars are compared: arrays, objects and non-JSON values are never equal,
  // whatever their identity (compare structured values with a jsonpath criterion)
  if (!isJSONScalar(a) || !isJSONScalar(b)) return false;

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

  // only two numbers or two strings are ordered; any other pair is unordered rather than
  // left to host-language coercion, and, as in RFC 9535, `<=` / `>=` hold if it is equal
  const bothNumbers = typeof left === 'number' && typeof right === 'number';
  const bothStrings = typeof left === 'string' && typeof right === 'string';
  if (!bothNumbers && !bothStrings) {
    return (operator === '<=' || operator === '>=') && looseEquals(a, b);
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

// evaluation is defined on the JSON value model, independent of the host language
// (null is handled separately; BigInt, Date, Map, functions, ... are not JSON values)
const isJSONScalar = (value) =>
  typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';

// a numeric string is one matching the grammar's own `number` rule (the JSON number
// format): no hex/binary/octal prefixes, leading zeros, '+' sign or surrounding whitespace
const NUMERIC = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const isNumeric = (str) => NUMERIC.test(str) && Number.isFinite(Number(str));

// A condition passes (truthy) when it evaluates to a truthy value; it fails (falsy)
// on false, null, or a missing (undefined) value.
const toBoolean = (value) => Boolean(value);

export default evaluate;
