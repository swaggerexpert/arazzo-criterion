import { Parser, Stats, Ast, identifiers, utilities } from 'apg-lite';

import Grammar from '../grammar.js';
import ASTTranslator from './translators/ASTTranslator/index.js';
import { parseOperand } from './translators/ASTTranslator/transformers.js';
import Trace from './trace/Trace.js';
import ArazzoCriterionParseError from '../errors/ArazzoCriterionParseError.js';

const grammar = new Grammar();

/**
 * The runtime expression operands of a condition that matches the grammar, in source order.
 * An internal AST pass keeps only the operands on the successful parse path.
 */
const operandsOf = (condition) => {
  const parser = new Parser();
  parser.ast = new Ast();
  parser.ast.callbacks['runtime-expression-operand'] = (state, chars, start, length, data) => {
    if (state === identifiers.SEM_PRE) data.push(utilities.charsToString(chars, start, length));
  };
  parser.parse(grammar, 'condition', condition);

  const operands = [];
  parser.ast.translate(operands);
  return operands;
};

const isValidOperand = (operand) => {
  try {
    parseOperand(operand);
    return true;
  } catch {
    return false;
  }
};

const parse = (
  condition,
  { startRule = 'condition', stats = false, trace = false, translator = new ASTTranslator() } = {},
) => {
  if (typeof condition !== 'string') {
    throw new TypeError('Criterion condition must be a string');
  }

  try {
    const parser = new Parser();

    if (translator) parser.ast = translator;
    if (stats) parser.stats = new Stats();
    if (trace) parser.trace = new Trace();

    const grammarResult = parser.parse(grammar, startRule, condition);

    // The grammar matches an operand as one bounded token ("$" 1*operand-char); whether the
    // token is a runtime expression (plus criterion accessors) is only decided here, so a
    // condition such as `$x == 1` matches the grammar but is not a valid condition.
    const invalidOperand =
      grammarResult.success &&
      startRule === 'condition' &&
      !operandsOf(condition).every(isValidOperand);
    const result = invalidOperand ? { ...grammarResult, success: false } : grammarResult;

    return {
      result,
      tree: result.success && translator ? parser.ast.getTree() : undefined,
      stats: parser.stats,
      trace: parser.trace,
    };
  } catch (error) {
    throw new ArazzoCriterionParseError('Unexpected error during Arazzo Criterion parsing', {
      cause: error,
      condition,
    });
  }
};

export default parse;
