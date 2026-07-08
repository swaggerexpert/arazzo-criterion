import { assert } from 'chai';
import { jestExpect as expect } from 'mocha-expect-snapshot';

import { parse, ASTTranslator } from '../../src/index.js';
import validConditions from '../fixtures/conditions-valid.js';

describe('parse', function () {
  context('ast-corpus', function () {
    validConditions.forEach((condition) => {
      specify(condition, function () {
        const parseResult = parse(condition, { translator: new ASTTranslator() });

        assert.isTrue(parseResult.result.success);
        expect(parseResult.tree).toMatchSnapshot();
      });
    });
  });
});
