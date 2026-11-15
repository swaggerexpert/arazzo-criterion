# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install              # Install dependencies
npm run build            # Full build: compile grammar + ES modules + CommonJS + bundled apg-lite + types/index.d.cts
npm run grammar:compile  # Compile src/grammar.bnf to src/grammar.js
npm run build:es         # Build ES modules only (to es/ directory)
npm run build:cjs        # Build CommonJS modules only (to cjs/ directory)
npm run build:types      # Copy types/index.d.ts to types/index.d.cts (also runs on npm pack)
npm test                 # Run all tests with Mocha (writes new snapshots)
npm run test:watch       # Run tests in watch mode
```

## Architecture

This library parses, validates, and evaluates the **`simple`** type of
[Arazzo Criterion Object](https://spec.openapis.org/arazzo/v1.1.0.html#criterion-object)
conditions, using an ABNF grammar and the apg-lite parser generator. The `regex`,
`jsonpath`, and `xpath` criterion types are out of scope.

### Core Components

- **`src/grammar.bnf`** - The complete, self-contained criterion grammar (standard RFC 5234 ABNF,
  no parser-specific extensions): the logical/comparison spine, literals, and the
  `runtime-expression-operand` rule. It does NOT embed the runtime-expression grammar; the operand is
  matched as one bounded token. When modified, run `npm run grammar:compile` to regenerate `src/grammar.js`.
- **`src/grammar.js`** - Auto-generated parser compiled from `src/grammar.bnf`. Do not edit directly.
- **`src/parse/index.js`** - Main `parse` function. Returns `{ result, tree, stats, trace }`.
- **`src/parse/translators/`** - Translators extending apg-lite's `Ast`:
  - `CSTTranslator` - Concrete Syntax Tree with `{ type, text, start, length, children }` nodes.
  - `ASTTranslator` - Abstract Syntax Tree with semantic node types (extends CSTTranslator).
  - `XMLTranslator` - XML representation of the CST (apg-lite `toXml()`, extends CSTTranslator).
- **`src/parse/translators/ASTTranslator/transformers.js`** - CST → AST transformers. Collapses the
  precedence-chain rules (`logical-or-expr`, `logical-and-expr`) into left-associative
  `LogicalExpression` nodes. For a `runtime-expression-operand` token, `parseOperand` uses
  `splitAtRuntimeExpression` to find the longest prefix that **parses via
  `@swaggerexpert/arazzo-runtime-expression`'s `parse()`** (the RE base, parsed again for its sub-AST);
  `parseNavigation` turns the remainder (`.member` / `[index]`) into the accessor path. `isValidOperand`
  does the same check without building trees, for the operand callback.
- **`src/evaluate/index.js`** - `evaluate(condition, { resolve })`. Applies the spec's
  loose-comparison semantics (case-insensitive strings, numeric-string coercion, null rules,
  truthiness) on the JSON value model: only JSON scalars are compared, navigation reads own members. Runtime expression values come from the caller-supplied
  `resolve(expression, ast)` function (raw string + parsed sub-AST).
- **`src/parse/callbacks/cst.js`** - Generic CST callback factory (copied from the runtime-expression package).
- **`src/parse/callbacks/operand.js`** - Parser rule callback that rejects operand tokens that are not
  valid runtime expressions (via `isValidOperand`), so `parse()` validates operands for every translator.

### Grammar Structure

The logical / comparison spine mirrors RFC 9535 section 2.3.5.1: a logical layer
(`||`, `&&`, `!`, grouping) over a flat, non-recursive comparison layer
(`comparable OP comparable`). This rejects chained comparisons (`a < b < c`) structurally.

**The critical design point** is the runtime-expression boundary. A runtime expression and the
criterion accessors (`.member`, `[index]`) both use `.` as a separator, so the boundary between them
cannot be expressed in a context-free grammar. The grammar therefore captures the operand as one
maximal token (`runtime-expression-operand = "$" 1*operand-char`), where `operand-char` excludes
whitespace and the criterion-significant characters (`! & ( ) < = > { | }`) so a trailing operator
is not absorbed. The split into base + navigation is resolved outside the grammar:

- `splitAtRuntimeExpression` asks `@swaggerexpert/arazzo-runtime-expression`'s `parse()` for the longest leading
  substring that is a valid runtime expression (using the failing parse's `maxMatched`, walked down to
  the longest clean prefix). That prefix is the RE base; its parsed tree is the RE sub-AST.
- `parseNavigation` parses the remainder (`.member` / `[index]`) into accessor nodes.

This makes validity **two-phase**: the grammar accepts a superset (any `$`-token in operand position),
and the RE reparse rejects tokens that are not valid runtime expressions (e.g. `$nonsense`). A parser
built from `grammar.bnf` alone is therefore necessary but not sufficient - operands must additionally
be validated against the Runtime Expressions grammar. `parse()` does both phases in one parse: an apg-lite
rule callback on `runtime-expression-operand` (`src/parse/callbacks/operand.js`) rejects a token that is not a valid
runtime expression, so the parse fails like on any other syntax error, for every translator and start rule.

Because the RE parser decides where the expression ends, reference families whose identifiers include
dots (`$inputs`, `$outputs`, `$workflows.*`, `$components.*`) consume their dots (no `.`-navigation into
them; use JSON Pointer `#/a/b`), while bounded families (`$response.body`, `$request.body`, `$statusCode`,
`$url`, `$method`) stop early so the trailing `.member` / `[index]` become criterion accessors (a
`RuntimeExpressionNavigation` node). Header names absorb `.` (an RFC 9110 `tchar`), so only `[index]` follows
them (`$request.header.x[0]`); query and path names absorb both (`$request.query.q[0]` is the name `q[0]`).

### Public API (exported from `src/index.js`)

- `parse(condition, options?)` - Parse a condition, returns `{ result, tree, stats, trace }`.
  `options.translator`: ASTTranslator (default), CSTTranslator, XMLTranslator, or null (validation only).
  Also `options.startRule`, `options.trace`, `options.stats`.
- `test(condition)` - Validate a condition, returns boolean.
- `evaluate(condition, { resolve })` - Evaluate against caller-supplied values, returns boolean.
  Throws a `TypeError` if `resolve` returns a native Promise. `util.promisify(evaluate)` returns
  `evaluateAsync` (via `Symbol.for('nodejs.util.promisify.custom')`, as ApiDOM's `traverse` does).
- `evaluateAsync(condition, { resolve })` - Same semantics, `resolve` may return a Promise; returns
  `Promise<boolean>` and reports every failure as a rejection. `src/evaluate/index.js` has two small
  tree walkers, `evaluateNode` (sync) and `evaluateNodeAsync` (async, awaits each operand in turn),
  sharing the comparison (`compare`) and navigation (`navigate`) helpers.
- `Grammar`, `CSTTranslator`, `ASTTranslator`, `XMLTranslator`, `Trace`.
- `ArazzoCriterionError`, `ArazzoCriterionParseError`, `ArazzoCriterionEvaluateError`.

### Testing

- `test/fixtures/conditions-valid.js` - Valid condition examples driving the snapshot corpora.
- `test/parse/ast-corpus.js`, `test/parse/cst-corpus.js` - Snapshot tests (mocha-expect-snapshot).
- `test/evaluate.js` - Evaluation semantics.
- `test/test.js`, `test/parse.js`, `test/grammar.js` - Validation, parse errors, grammar round-trip.

### Build Output

Dual module formats: `es/` (ESM `.mjs`), `cjs/` (CommonJS `.cjs`), `types/` (TypeScript). Typings live in
`types/index.d.ts` (ESM); `npm run build:types` copies them to `types/index.d.cts` (generated, gitignored), which the
`require` export condition points to, so CommonJS consumers with `node16`/`nodenext` resolution get types. Babel handles
transformation; the module-resolver plugin rewrites the `apg-lite` import to the bundled `cjs/apg-lite.cjs`.
