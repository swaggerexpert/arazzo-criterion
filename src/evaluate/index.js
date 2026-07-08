import parse from '../parse/index.js';
import ArazzoCriterionEvaluateError from '../errors/ArazzoCriterionEvaluateError.js';

/**
 * Evaluate a "simple" Arazzo criterion condition.
 *
 * Runtime expression values are supplied by the caller through `resolve`, which
 * receives the runtime expression string and its parsed sub-AST, and returns the
 * concrete value.
 *
 * @example
 * evaluate('$statusCode == 200', {
 *   resolve: (expression, ast) => (expression === '$statusCode' ? 200 : undefined),
 * }); // => true
 */
const evaluate = (condition, { resolve } = {}) => {
  if (typeof condition !== 'string') {
    throw new TypeError('Criterion condition must be a string');
  }
  if (typeof resolve !== 'function') {
    throw new TypeError('evaluate requires a "resolve" function in options');
  }

  const { result, tree } = parse(condition);
  if (!result.success) {
    throw new ArazzoCriterionEvaluateError('Invalid criterion condition', { condition });
  }

  return toBoolean(evaluateNode(tree, resolve));
};

const evaluateNode = (node, resolve) => {
  switch (node.type) {
    case 'LogicalExpression':
      return evaluateLogical(node, resolve);
    case 'UnaryExpression':
      return !toBoolean(evaluateNode(node.argument, resolve));
    case 'BinaryExpression':
      return evaluateComparison(node, resolve);
    case 'Literal':
      return node.value;
    case 'RuntimeExpression':
      return resolve(node.text, node.expression);
    case 'RuntimeExpressionNavigation':
      return evaluateNavigation(node, resolve);
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

const evaluateNavigation = (node, resolve) => {
  let value = resolve(node.expression.text, node.expression.expression);
  for (const step of node.navigation) {
    if (value == null) return undefined;
    value = step.type === 'MemberAccess' ? value[step.name] : value[step.value];
  }
  return value;
};

const evaluateComparison = (node, resolve) => {
  const left = evaluateNode(node.left, resolve);
  const right = evaluateNode(node.right, resolve);

  switch (node.operator) {
    case '==':
      return looseEquals(left, right);
    case '!=':
      return !looseEquals(left, right);
    case '<':
    case '<=':
    case '>':
    case '>=':
      return relational(node.operator, left, right);
    default:
      throw new ArazzoCriterionEvaluateError(`Unknown comparison operator: ${node.operator}`);
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
