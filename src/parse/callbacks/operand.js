import { identifiers, utilities } from 'apg-lite';

import { isValidOperand } from '../translators/ASTTranslator/transformers.js';

/**
 * Parser rule callback for `runtime-expression-operand`.
 *
 * The grammar matches an operand as one bounded token ("$" 1*operand-char); whether the token is
 * a runtime expression with valid criterion accessors is decided here, during parsing, so that an
 * invalid operand fails the parse like any other syntax error, whatever the translator.
 */
const operand = (sys, chars, phraseIndex) => {
  if (sys.state !== identifiers.MATCH) return;
  if (!isValidOperand(utilities.charsToString(chars, phraseIndex, sys.phraseLength))) {
    sys.state = identifiers.NOMATCH;
    sys.phraseLength = 0;
  }
};

export default operand;
