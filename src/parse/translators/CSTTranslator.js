import { Ast as AST } from 'apg-lite';

import cstCallback from '../callbacks/cst.js';

class CSTTranslator extends AST {
  constructor() {
    super();

    // logical / comparison spine
    this.callbacks['condition'] = cstCallback('condition');
    this.callbacks['logical-or-expr'] = cstCallback('logical-or-expr');
    this.callbacks['logical-and-expr'] = cstCallback('logical-and-expr');
    this.callbacks['paren-expr'] = cstCallback('paren-expr');
    this.callbacks['comparison-expr'] = cstCallback('comparison-expr');
    this.callbacks['test-expr'] = cstCallback('test-expr');
    this.callbacks['logical-not-op'] = cstCallback('logical-not-op');
    this.callbacks['comparison-op'] = cstCallback('comparison-op');

    // comparable operand (runtime expression + navigation), captured as one token
    this.callbacks['runtime-expression-operand'] = cstCallback('runtime-expression-operand');

    // navigation (secondary entry point; parses the accessor remainder of an operand)
    this.callbacks['runtime-expression-navigation'] = cstCallback('runtime-expression-navigation');
    this.callbacks['member-access'] = cstCallback('member-access');
    this.callbacks['index-access'] = cstCallback('index-access');
    this.callbacks['member-name'] = cstCallback('member-name');
    this.callbacks['index'] = cstCallback('index');

    // literals
    this.callbacks['number'] = cstCallback('number');
    this.callbacks['string'] = cstCallback('string');
    this.callbacks['boolean'] = cstCallback('boolean');
    this.callbacks['null'] = cstCallback('null');
  }

  getTree() {
    const data = { stack: [], root: null };
    this.translate(data);
    return data.root;
  }
}

export default CSTTranslator;
