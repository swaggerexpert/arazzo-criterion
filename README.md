# @swaggerexpert/arazzo-criterion

[![npmversion](https://img.shields.io/npm/v/%40swaggerexpert%2Farazzo-criterion?style=flat-square&label=npm%20package&color=%234DC81F&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40swaggerexpert%2Farazzo-criterion)](https://www.npmjs.com/package/@swaggerexpert/arazzo-criterion)
[![npm](https://img.shields.io/npm/dm/@swaggerexpert/arazzo-criterion)](https://www.npmjs.com/package/@swaggerexpert/arazzo-criterion)
[![Test workflow](https://github.com/swaggerexpert/arazzo-criterion/actions/workflows/test.yml/badge.svg)](https://github.com/swaggerexpert/arazzo-criterion/actions)
[![Dependabot enabled](https://img.shields.io/badge/Dependabot-enabled-blue.svg)](https://dependabot.com/)
[![try on RunKit](https://img.shields.io/badge/try%20on-RunKit-brightgreen.svg?style=flat)](https://npm.runkit.com/@swaggerexpert/arazzo-criterion)
[![Tidelift](https://tidelift.com/badges/package/npm/@swaggerexpert%2Farazzo-criterion)](https://tidelift.com/subscription/pkg/npm-.swaggerexpert-arazzo-criterion?utm_source=npm-swaggerexpert-arazzo-criterion&utm_medium=referral&utm_campaign=readme)

[Arazzo Criterion Objects](https://spec.openapis.org/arazzo/v1.1.0.html#criterion-object) specify the conditions used in `successCriteria` of a [Step Object](https://spec.openapis.org/arazzo/v1.1.0.html#step-object)
and in the `criteria` of Success and Failure Action Objects.

`@swaggerexpert/arazzo-criterion` is a **parser**, **validator** and **evaluator** for the **`simple`** type of Arazzo Criterion conditions **only**.
The `regex`, `jsonpath` and `xpath` criterion types are **out of scope** — they delegate to external engines (a regular-expression engine, a [JSONPath](https://github.com/swaggerexpert/jsonpath) engine, an XPath engine) and belong in a higher-level evaluator that composes this package with those.

The `simple` condition syntax combines literals, comparison and logical operators, property de-reference / index accessors, and [Arazzo Runtime Expressions](https://spec.openapis.org/arazzo/v1.1.0.html#runtime-expressions).
Runtime Expression operands are parsed by delegating to [@swaggerexpert/arazzo-runtime-expression](https://github.com/swaggerexpert/arazzo-runtime-expression), so their sub-ASTs match that package exactly.

In an Arazzo document, a `simple` criterion appears in a step's `successCriteria` (or an action's `criteria`). The `type` defaults to `simple`, so a criterion is usually just a `condition` string:

```yaml
steps:
  - stepId: getPet
    # ...
    successCriteria:
      - condition: $statusCode == 200
      - condition: $response.body.status == 'available' && $response.body.pets[0].id > 0
```

Written out as full Criterion Objects, those two entries are:

```yaml
successCriteria:
  - condition: $statusCode == 200
    type: simple                      # the default; may be omitted
  - condition: $response.body.status == 'available' && $response.body.pets[0].id > 0
    type: simple
```

This library parses, validates and evaluates the `condition` string of such `simple` criteria.

It supports the `simple` Criterion Object condition defined in the following Arazzo specification versions:

- [Arazzo 1.0.0](https://spec.openapis.org/arazzo/v1.0.0.html)
- [Arazzo 1.0.1](https://spec.openapis.org/arazzo/v1.0.1.html)
- [Arazzo 1.1.0](https://spec.openapis.org/arazzo/v1.1.0.html)

<table>
  <tr>
    <td align="right" valign="middle">
        <img src="https://raw.githubusercontent.com/swaggerexpert/arazzo-criterion/main/assets/tidelift.webp" alt="Tidelift" width="60" />
      </td>
      <td valign="middle">
        <a href="https://tidelift.com/subscription/pkg/npm-.swaggerexpert-arazzo-criterion?utm_source=npm-swaggerexpert-arazzo-criterion&utm_medium=referral&utm_campaign=readme">
            Get professionally supported @swaggerexpert/arazzo-criterion with Tidelift Subscription.
        </a>
      </td>
  </tr>
</table>

## Table of Contents

- [Getting started](#getting-started)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Parsing](#parsing)
      - [Translators](#translators)
      - [Statistics](#statistics)
      - [Tracing](#tracing)
    - [Validation](#validation)
    - [Evaluation](#evaluation)
    - [Errors](#errors)
    - [Grammar](#grammar)
- [More about the `simple` criterion condition](#more-about-the-simple-criterion-condition)
- [License](#license)

## Getting started

### Installation

```sh
 $ npm install @swaggerexpert/arazzo-criterion
```

### Usage

#### Parsing

Parsing a criterion condition is as simple as importing the **parse** function and calling it.

```js
import { parse } from '@swaggerexpert/arazzo-criterion';

const parseResult = parse('$statusCode == 200 && $response.body.data != null');
```

**parseResult** variable has the following shape:

```
{
  result: <ParseResult['result']>,
  tree: <ParseResult['tree']>,
  stats: <ParseResult['stats']>,
  trace: <ParseResult['trace']>,
}
```

[TypeScript typings](https://github.com/swaggerexpert/arazzo-criterion/blob/main/types/index.d.ts) are available for all fields attached to the parse result object returned by the `parse` function.

##### Translators

`@swaggerexpert/arazzo-criterion` provides several translators to convert the parse result into different tree representations.

###### CST translator

[Concrete Syntax Tree](https://en.wikipedia.org/wiki/Parse_tree) (Parse tree) representation is available on the parse result
when an instance of `CSTTranslator` is provided via the `translator` option to the `parse` function.
CST is suitable to be consumed by other tools like IDEs, editors, etc...

```js
import { parse, CSTTranslator } from '@swaggerexpert/arazzo-criterion';

const { tree: cst } = parse('$statusCode == 200', { translator: new CSTTranslator() });
```

CST tree has a shape documented by [TypeScript typings (CSTNode)](https://github.com/swaggerexpert/arazzo-criterion/blob/main/types/index.d.ts).

###### AST translator

**Default translator**. [Abstract Syntax Tree](https://en.wikipedia.org/wiki/Abstract_syntax_tree) representation is available on the parse result
by default or when an instance of `ASTTranslator` is provided via the `translator` option to the `parse` function.
AST is suitable to be consumed by implementations that need to analyze or evaluate the condition.

```js
import { parse } from '@swaggerexpert/arazzo-criterion';

const { tree: ast } = parse('$statusCode == 200 && $response.body.data != null');
```

or

```js
import { parse, ASTTranslator } from '@swaggerexpert/arazzo-criterion';

const { tree: ast } = parse('$statusCode == 200', { translator: new ASTTranslator() });
```

AST tree has a shape documented by [TypeScript typings (ConditionAST)](https://github.com/swaggerexpert/arazzo-criterion/blob/main/types/index.d.ts).

The AST produced for `$statusCode == 200 && $response.body.data != null` is:

```js
{
  type: 'LogicalExpression',
  operator: '&&',
  left: {
    type: 'BinaryExpression',
    operator: '==',
    left: { type: 'RuntimeExpression', text: '$statusCode', expression: { type: 'StatusCodeExpression' } },
    right: { type: 'Literal', valueType: 'number', value: 200 },
  },
  right: {
    type: 'BinaryExpression',
    operator: '!=',
    left: {
      type: 'RuntimeExpressionNavigation',
      expression: { type: 'RuntimeExpression', text: '$response.body', expression: {  ...  } },
      navigation: [{ type: 'MemberAccess', name: 'data' }],
    },
    right: { type: 'Literal', valueType: 'null', value: null },
  },
}
```

A runtime expression with **no** accessors is represented as a `RuntimeExpression` node directly; a `RuntimeExpressionNavigation` node appears only when there is at least one `.member` / `[index]` accessor.

###### XML translator

An XML string representation of the parse tree is available on the parse result
when an instance of `XMLTranslator` is provided via the `translator` option to the `parse` function.

```js
import { parse, XMLTranslator } from '@swaggerexpert/arazzo-criterion';

const { tree: xml } = parse('$statusCode == 200', { translator: new XMLTranslator() });
```

##### Statistics

`parse` returns additional statistical information about the parsing process.
Collection of the statistics can be enabled by setting the `stats` option to `true`.

```js
import { parse } from '@swaggerexpert/arazzo-criterion';

const { stats } = parse('$statusCode == 200', { stats: true });

stats.displayStats(); // returns operator statistics as string
```

##### Tracing

`parse` returns additional tracing information about the parsing process.
Tracing can be enabled by setting the `trace` option to `true`. Tracing is essential
for debugging failed parses or analyzing rule execution flow.

```js
import { parse } from '@swaggerexpert/arazzo-criterion';

const { result, trace } = parse('$statusCode <', { trace: true });

result.success; // false
trace.displayTrace(); // returns trace information as string
```

Tracing also allows you to infer expected tokens at a failure point. This is useful for generating meaningful syntax error messages.

```js
import { parse } from '@swaggerexpert/arazzo-criterion';

const { trace } = parse('$statusCode nonsense', { trace: true });

const expectations = trace.inferExpectations();
console.log(expectations.toString()); // the tokens that could appear at the failure point
```

#### Validation

```js
import { test } from '@swaggerexpert/arazzo-criterion';

test('$statusCode == 200'); // => true
test('$statusCode < 200 < 300'); // => false (chained comparisons are invalid)
```

#### Evaluation

`evaluate` runs a condition against caller-supplied values. Because a criterion only becomes concrete once its runtime expressions are resolved against a live context, you provide a `resolve` function. It receives the runtime expression **string** and its parsed **sub-AST**, and returns the concrete value — so you can key on either the raw string or dispatch on the AST `type`.

```js
import { evaluate } from '@swaggerexpert/arazzo-criterion';

const context = {
  $statusCode: 200,
  '$response.body': { status: 'Available', data: [{ id: 42 }] },
};
const resolve = (expression, ast) => context[expression];

evaluate('$statusCode == 200', { resolve }); // => true
evaluate("$response.body.status == 'available'", { resolve }); // => true (case-insensitive)
evaluate('$response.body.data[0].id > 10', { resolve }); // => true
```

Evaluation follows the "loose comparison" rules from the Arazzo specification:

- string comparisons are **case-insensitive**;
- numeric strings are **coerced** to numbers when compared with a number;
- `null` is equal only to `null`; any relational comparison involving `null` is `false`;
- a condition **passes** when it evaluates to a truthy value and **fails** on `false`, `null`, or a missing value.

#### Errors

`@swaggerexpert/arazzo-criterion` provides a structured error class hierarchy,
enabling precise error handling across parsing and evaluation.

```js
import {
  ArazzoCriterionError,
  ArazzoCriterionParseError,
  ArazzoCriterionEvaluateError,
} from '@swaggerexpert/arazzo-criterion';
```

**ArazzoCriterionError** is the base class for all errors. **ArazzoCriterionParseError** wraps an unexpected error
raised during parsing, and **ArazzoCriterionEvaluateError** is thrown by `evaluate` (for example, when the condition
is not valid). Both extend `ArazzoCriterionError` and include the offending `condition`.

```js
import { evaluate, ArazzoCriterionEvaluateError } from '@swaggerexpert/arazzo-criterion';

try {
  evaluate('== 200', { resolve: () => undefined }); // invalid condition
} catch (error) {
  if (error instanceof ArazzoCriterionEvaluateError) {
    console.log(error.condition); // the condition that failed: "== 200"
  }
}
```

Note: a syntactically invalid condition passed to `parse` does **not** throw - it returns a result with
`result.success === false` and `tree === undefined`. Use `test` for a simple boolean validity check.

#### Grammar

New grammar instance can be created in the following way:

```js
import { Grammar } from '@swaggerexpert/arazzo-criterion';

const grammar = new Grammar();
```

To obtain the original ABNF grammar as a string:

```js
import { Grammar } from '@swaggerexpert/arazzo-criterion';

const grammar = new Grammar();

grammar.toString();
// or
String(grammar);
```

## More about the `simple` criterion condition

The logical / comparison spine follows the structure of [RFC 9535](https://www.rfc-editor.org/rfc/rfc9535) (JSONPath filter expressions):
a logical layer (`||`, `&&`, `!`, grouping) that composes only booleans, over a flat, non-recursive comparison layer (`comparable OP comparable`).
This rejects nonsensical forms such as chained comparisons (`a < b < c`) at the grammar level.

Operands are Arazzo Runtime Expressions, optionally followed by property-dereference (`.member`) and index (`[n]`) accessors. The grammar matches an
operand as a single bounded token; the runtime-expression base and the trailing accessors are separated during AST construction by delegating the base
to [@swaggerexpert/arazzo-runtime-expression](https://github.com/swaggerexpert/arazzo-runtime-expression) (see the grammar header note for why the
boundary cannot be expressed in a context-free grammar).

The `simple` criterion condition is defined by the following [ABNF](https://tools.ietf.org/html/rfc5234) (RFC 5234) syntax:

```abnf
; Arazzo Criterion Object - "simple" condition ABNF syntax
; https://spec.openapis.org/arazzo/v1.1.0.html#criterion-object

; ---------------------------------------------------------------------------
; Criterion condition (simple type)
; ---------------------------------------------------------------------------

condition        = S logical-expr S

logical-expr     = logical-or-expr
logical-or-expr  = logical-and-expr *( S "||" S logical-and-expr )
logical-and-expr = basic-expr *( S "&&" S basic-expr )

basic-expr       = paren-expr / comparison-expr / test-expr
paren-expr       = [ logical-not-op S ] "(" S logical-expr S ")"
test-expr        = [ logical-not-op S ] comparable
comparison-expr  = comparable S comparison-op S comparable

logical-not-op   = "!"
comparison-op    = "==" / "!=" / "<=" / ">=" / "<" / ">"

; ---------------------------------------------------------------------------
; Comparables: literals or operands (runtime expression + navigation, matched
; as one bounded token)
; ---------------------------------------------------------------------------

comparable                 = literal / runtime-expression-operand
runtime-expression-operand = "$" 1*operand-char
operand-char               = %x22-25 / %x27 / %x2A-3B / %x3F-5A / %x5B-5D / %x5E-7A / %x7E / %x80-10FFFF

; Navigation over the resolved runtime-expression value (secondary entry point;
; parsed from the operand remainder during AST construction).
runtime-expression-navigation = 1*( member-access / index-access )
member-access                 = "." member-name
index-access                  = "[" index "]"
member-name                   = 1*( ALPHA / DIGIT / "_" / "-" )
index                         = 1*DIGIT

; ---------------------------------------------------------------------------
; Literals
; ---------------------------------------------------------------------------

literal          = number / string / boolean / null
boolean          = "true" / "false"
null             = "null"

number           = ( int / "-0" ) [ frac ] [ exp ]
int              = "0" / ( [ "-" ] DIGIT1 *DIGIT )
frac             = "." 1*DIGIT
exp              = ( "e" / "E" ) [ "-" / "+" ] 1*DIGIT
DIGIT1           = %x31-39   ; 1-9 non-zero digit

; single-quoted; a literal quote is escaped by doubling it ('')
string           = squote *( escaped-quote / string-char ) squote
escaped-quote    = squote squote                 ; '' represents a single '
string-char      = %x20-26 / %x28-10FFFF         ; any char except squote (%x27)
squote           = %x27                           ; '

; ---------------------------------------------------------------------------
; Whitespace (optional blank space), per RFC 9535
; ---------------------------------------------------------------------------

S                = *B
B                = %x20 / %x09 / %x0A / %x0D      ; space, tab, LF, CR

; ---------------------------------------------------------------------------
; Core rules (RFC 5234 B.1)
; ---------------------------------------------------------------------------

ALPHA          = %x41-5A / %x61-7A   ; A-Z / a-z
DIGIT          = %x30-39             ; 0-9
```

The canonical, fully-commented grammar (including the RFC 9535 attribution and the boundary rationale) lives in [`src/grammar.bnf`](https://github.com/swaggerexpert/arazzo-criterion/blob/main/src/grammar.bnf).

## License

`@swaggerexpert/arazzo-criterion` is licensed under [Apache 2.0 license](https://github.com/swaggerexpert/arazzo-criterion/blob/main/LICENSE).
`@swaggerexpert/arazzo-criterion` comes with an explicit [NOTICE](https://github.com/swaggerexpert/arazzo-criterion/blob/main/NOTICE) file
containing additional legal notices and information.
