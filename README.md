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
The `regex`, `jsonpath` and `xpath` criterion types are **out of scope** — they delegate to external engines (a regular-expression engine, [@swaggerexpert/jsonpath](https://github.com/swaggerexpert/jsonpath), an XPath engine) and belong in a higher-level evaluator that composes this package with those.

The `simple` condition syntax combines literals, comparison and logical operators, property de-reference / index accessors, and [Arazzo Runtime Expressions](https://spec.openapis.org/arazzo/v1.1.0.html#runtime-expressions).
Runtime Expression operands are parsed by delegating to [@swaggerexpert/arazzo-runtime-expression](https://github.com/swaggerexpert/arazzo-runtime-expression), so their sub-ASTs match that package exactly.

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
- [The `simple` condition grammar](#the-simple-condition-grammar)
- [License](#license)

## Getting started

### Installation

```sh
 $ npm install @swaggerexpert/arazzo-criterion
```

### Usage

#### Parsing

`parse` produces an Abstract Syntax Tree (AST) by default.

```js
import { parse } from '@swaggerexpert/arazzo-criterion';

const { result, tree } = parse('$statusCode == 200 && $response.body.data != null');

result.success; // => true
tree;
/*
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
*/
```

##### AST node types

| Node | Shape |
| --- | --- |
| `LogicalExpression` | `{ operator: '&&' \| '\|\|', left, right }` |
| `UnaryExpression` | `{ operator: '!', argument }` |
| `BinaryExpression` | `{ operator: '==' \| '!=' \| '<' \| '<=' \| '>' \| '>=', left, right }` |
| `Literal` | `{ valueType: 'number' \| 'string' \| 'boolean' \| 'null', value }` |
| `RuntimeExpression` | `{ text, expression }` (`expression` is the runtime-expression sub-AST) |
| `RuntimeExpressionNavigation` | `{ expression: RuntimeExpression, navigation: (MemberAccess \| IndexAccess)[] }` |
| `MemberAccess` | `{ name }` (from `.property`) |
| `IndexAccess` | `{ value }` (from `[n]`, 0-based) |

A runtime expression with **no** accessors is represented as a `RuntimeExpression` node directly; a `RuntimeExpressionNavigation` node appears only when there is at least one `.member` / `[index]` accessor.

##### Translators

```js
import { parse, CSTTranslator, ASTTranslator } from '@swaggerexpert/arazzo-criterion';

parse('$statusCode == 200', { translator: new ASTTranslator() }); // default
parse('$statusCode == 200', { translator: new CSTTranslator() }); // Concrete Syntax Tree
parse('$statusCode == 200', { translator: null });                // validation only
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

```js
import {
  ArazzoCriterionError,
  ArazzoCriterionParseError,
  ArazzoCriterionEvaluateError,
} from '@swaggerexpert/arazzo-criterion';
```

`ArazzoCriterionParseError` and `ArazzoCriterionEvaluateError` both extend `ArazzoCriterionError`.

#### Grammar

```js
import { Grammar } from '@swaggerexpert/arazzo-criterion';

const grammar = new Grammar();
```

## The `simple` condition grammar

The logical / comparison spine follows the structure of [RFC 9535](https://www.rfc-editor.org/rfc/rfc9535) (JSONPath filter expressions):
a logical layer (`||`, `&&`, `!`, grouping) that composes only booleans, over a flat, non-recursive comparison layer (`comparable OP comparable`).
This rejects nonsensical forms such as chained comparisons (`a < b < c`) at the grammar level.

Operands are Arazzo Runtime Expressions, optionally followed by property-dereference (`.member`) and index (`[n]`) accessors. Each runtime expression stops at its own natural boundary (e.g. `$response.body` ends at `body`), so the trailing `.data` in `$response.body.data` is captured as a criterion accessor rather than being absorbed into the expression.

See [`src/grammar.bnf`](./src/grammar.bnf) for the full ABNF.

## License

`@swaggerexpert/arazzo-criterion` is licensed under [Apache 2.0 license](https://github.com/swaggerexpert/arazzo-criterion/blob/main/LICENSE).
`@swaggerexpert/arazzo-criterion` comes with an explicit [NOTICE](https://github.com/swaggerexpert/arazzo-criterion/blob/main/NOTICE) file
containing additional legal notices and information.
