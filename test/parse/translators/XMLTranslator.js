import { assert } from 'chai';
import { jestExpect as expect } from 'mocha-expect-snapshot';

import { parse, XMLTranslator } from '../../../src/index.js';

describe('parse', function () {
  context('translators', function () {
    context('XMLTranslator', function () {
      specify('should translate $statusCode == 200 to XML', function () {
        const parseResult = parse('$statusCode == 200', { translator: new XMLTranslator() });

        assert.isTrue(parseResult.result.success);
        expect(parseResult.tree).toMatchSnapshot();
      });

      specify('should translate $response.body.data[0].id > 10 to XML', function () {
        const parseResult = parse('$response.body.data[0].id > 10', {
          translator: new XMLTranslator(),
        });

        assert.isTrue(parseResult.result.success);
        expect(parseResult.tree).toMatchSnapshot();
      });
    });
  });
});
