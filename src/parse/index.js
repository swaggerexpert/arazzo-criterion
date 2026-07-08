import { Parser, Stats } from 'apg-lite';

import Grammar from '../grammar.js';
import ASTTranslator from './translators/ASTTranslator/index.js';
import Trace from './trace/Trace.js';
import ArazzoCriterionParseError from '../errors/ArazzoCriterionParseError.js';

const grammar = new Grammar();

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

    const result = parser.parse(grammar, startRule, condition);

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
