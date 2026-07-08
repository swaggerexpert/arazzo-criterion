import { parse as parseRuntimeExpression } from '@swaggerexpert/arazzo-runtime-expression';

import parse from '../../index.js';

export const transformCSTtoAST = (node, transformerMap) => {
  const transformer = transformerMap[node.type];
  if (!transformer) {
    throw new Error(`No transformer for CST node type: ${node.type}`);
  }
  return transformer(node);
};

// A basic-expr is not a registered CST rule, so its alternatives
// (paren-expr / comparison-expr / test-expr) and the literal alternatives
// (number / string / boolean / null) surface directly as children.
const OPERAND_TYPES = new Set([
  'paren-expr',
  'comparison-expr',
  'test-expr',
  'runtime-expression-operand',
  'number',
  'string',
  'boolean',
  'null',
]);

/**
 * Split an operand token at the boundary between its runtime-expression base and the
 * trailing criterion navigation, returning both as text. The base is the longest
 * leading substring that parses as a runtime expression.
 *
 * The grammar cannot find this boundary itself - a runtime expression and the
 * criterion accessors both use "." - so it is resolved here by delegating to
 * @swaggerexpert/arazzo-runtime-expression.
 */
const splitAtRuntimeExpression = (operand) => {
  const full = parseRuntimeExpression(operand);
  if (full.result.success) {
    return { expressionText: operand, navigationText: '' };
  }

  // A failing parse reports how far it matched; walk down from there to the
  // longest prefix that parses cleanly (robust against stopping mid-rule).
  for (let n = full.result.maxMatched; n > 0; n -= 1) {
    if (parseRuntimeExpression(operand.slice(0, n)).result.success) {
      return { expressionText: operand.slice(0, n), navigationText: operand.slice(n) };
    }
  }

  throw new Error(`Operand is not a valid runtime expression: "${operand}"`);
};

/**
 * Parse a criterion navigation remainder (e.g. ".data[0].id") into a MemberAccess /
 * IndexAccess path by parsing it against the grammar's `runtime-expression-navigation`
 * rule (a secondary entry point); the ASTTranslator produces the path array directly.
 * Throws if the remainder is not a valid accessor sequence.
 */
const parseNavigation = (navigationText) => {
  const { result, tree } = parse(navigationText, { startRule: 'runtime-expression-navigation' });

  if (!result.success) {
    throw new Error(`Invalid criterion navigation: "${navigationText}"`);
  }

  return tree;
};

/**
 * Parse an operand token into its runtime-expression base and criterion navigation,
 * both already parsed. `navigation` is an empty array when there are no accessors.
 */
const parseOperand = (operand) => {
  const { expressionText, navigationText } = splitAtRuntimeExpression(operand);

  const runtimeExpression = {
    type: 'RuntimeExpression',
    text: expressionText,
    expression: parseRuntimeExpression(expressionText).tree,
  };
  const navigation = navigationText === '' ? [] : parseNavigation(navigationText);

  return { runtimeExpression, navigation };
};

const foldLeftAssociative = (operands, operator) =>
  operands.reduce((left, right) => ({
    type: 'LogicalExpression',
    operator,
    left,
    right,
  }));

const transformers = {
  ['condition'](node) {
    const child = node.children.find((c) => c.type === 'logical-or-expr');
    return transformCSTtoAST(child, transformers);
  },

  ['logical-or-expr'](node) {
    const operands = node.children
      .filter((c) => c.type === 'logical-and-expr')
      .map((c) => transformCSTtoAST(c, transformers));
    return operands.length === 1 ? operands[0] : foldLeftAssociative(operands, '||');
  },

  ['logical-and-expr'](node) {
    const operands = node.children
      .filter((c) => OPERAND_TYPES.has(c.type))
      .map((c) => transformCSTtoAST(c, transformers));
    return operands.length === 1 ? operands[0] : foldLeftAssociative(operands, '&&');
  },

  ['paren-expr'](node) {
    const inner = node.children.find((c) => c.type === 'logical-or-expr');
    const argument = transformCSTtoAST(inner, transformers);
    const negated = node.children.some((c) => c.type === 'logical-not-op');
    return negated ? { type: 'UnaryExpression', operator: '!', argument } : argument;
  },

  ['test-expr'](node) {
    const operandNode = node.children.find((c) => OPERAND_TYPES.has(c.type));
    const argument = transformCSTtoAST(operandNode, transformers);
    const negated = node.children.some((c) => c.type === 'logical-not-op');
    return negated ? { type: 'UnaryExpression', operator: '!', argument } : argument;
  },

  ['comparison-expr'](node) {
    const operands = node.children.filter((c) => OPERAND_TYPES.has(c.type));
    const opNode = node.children.find((c) => c.type === 'comparison-op');
    return {
      type: 'BinaryExpression',
      operator: opNode.text,
      left: transformCSTtoAST(operands[0], transformers),
      right: transformCSTtoAST(operands[1], transformers),
    };
  },

  ['runtime-expression-operand'](node) {
    const { runtimeExpression, navigation } = parseOperand(node.text);

    if (navigation.length === 0) return runtimeExpression;

    return { type: 'RuntimeExpressionNavigation', expression: runtimeExpression, navigation };
  },

  ['runtime-expression-navigation'](node) {
    return node.children
      .filter((c) => c.type === 'member-access' || c.type === 'index-access')
      .map((c) => transformCSTtoAST(c, transformers));
  },

  ['member-access'](node) {
    const nameNode = node.children.find((c) => c.type === 'member-name');
    return { type: 'MemberAccess', name: nameNode.text };
  },

  ['index-access'](node) {
    const indexNode = node.children.find((c) => c.type === 'index');
    return { type: 'IndexAccess', value: Number(indexNode.text) };
  },

  ['number'](node) {
    return { type: 'Literal', valueType: 'number', value: Number(node.text) };
  },

  ['string'](node) {
    // strip surrounding single quotes, then collapse doubled '' into a single '
    const inner = node.text.slice(1, -1).replace(/''/g, "'");
    return { type: 'Literal', valueType: 'string', value: inner };
  },

  ['boolean'](node) {
    return { type: 'Literal', valueType: 'boolean', value: node.text === 'true' };
  },

  ['null'](node) {
    return { type: 'Literal', valueType: 'null', value: null };
  },
};

export default transformers;
