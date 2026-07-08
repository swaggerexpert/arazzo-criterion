import type { ASTNode as RuntimeExpressionAST } from '@swaggerexpert/arazzo-runtime-expression';

/**
 * CST Node - Concrete Syntax Tree node
 * https://spec.openapis.org/arazzo/v1.1.0.html#criterion-object
 */
export interface CSTNode {
  readonly type: string;
  readonly text: string;
  readonly start: number;
  readonly length: number;
  readonly children: CSTNode[];
}

/**
 * Translator base interface
 */
export interface Translator {
  getTree(): CSTNode | ConditionAST | undefined;
}

/**
 * CSTTranslator - Produces Concrete Syntax Tree
 */
export class CSTTranslator implements Translator {
  constructor();
  getTree(): CSTNode;
}

/**
 * AST Node Types for the "simple" criterion condition.
 * https://spec.openapis.org/arazzo/v1.1.0.html#criterion-object
 */

export type LiteralValueType = 'number' | 'string' | 'boolean' | 'null';

/**
 * A literal operand: number, single-quoted string, boolean, or null.
 */
export interface Literal {
  readonly type: 'Literal';
  readonly valueType: LiteralValueType;
  readonly value: number | string | boolean | null;
}

/**
 * A runtime expression operand, delegated to
 * @swaggerexpert/arazzo-runtime-expression for its sub-AST.
 */
export interface RuntimeExpression {
  readonly type: 'RuntimeExpression';
  readonly text: string;
  readonly expression: RuntimeExpressionAST;
}

/**
 * Property de-reference accessor - ".name"
 */
export interface MemberAccess {
  readonly type: 'MemberAccess';
  readonly name: string;
}

/**
 * Index accessor - "[n]" (0-based)
 */
export interface IndexAccess {
  readonly type: 'IndexAccess';
  readonly value: number;
}

export type Accessor = MemberAccess | IndexAccess;

/**
 * A runtime expression followed by one or more property/index accessors.
 * A runtime expression with no accessors is represented as RuntimeExpression directly.
 */
export interface RuntimeExpressionNavigation {
  readonly type: 'RuntimeExpressionNavigation';
  readonly expression: RuntimeExpression;
  readonly navigation: Accessor[];
}

export type ComparisonOperator = '==' | '!=' | '<' | '<=' | '>' | '>=';

/**
 * A comparison between two comparables.
 */
export interface BinaryExpression {
  readonly type: 'BinaryExpression';
  readonly operator: ComparisonOperator;
  readonly left: Comparable;
  readonly right: Comparable;
}

/**
 * A logical AND / OR composition.
 */
export interface LogicalExpression {
  readonly type: 'LogicalExpression';
  readonly operator: '&&' | '||';
  readonly left: ConditionAST;
  readonly right: ConditionAST;
}

/**
 * A logical NOT.
 */
export interface UnaryExpression {
  readonly type: 'UnaryExpression';
  readonly operator: '!';
  readonly argument: ConditionAST;
}

/**
 * Operands of a comparison / bare truthy condition.
 */
export type Comparable = Literal | RuntimeExpression | RuntimeExpressionNavigation;

/**
 * Any node in a parsed "simple" criterion condition.
 */
export type ConditionAST = LogicalExpression | UnaryExpression | BinaryExpression | Comparable;

/**
 * ASTTranslator - Produces Abstract Syntax Tree
 */
export class ASTTranslator implements Translator {
  constructor();
  getTree(): ConditionAST;
}

/**
 * Trace - For debugging parse operations
 */
export class Trace {
  constructor();
  displayTrace(): string;
  inferExpectations(): Expectations;
}

/**
 * Expectations - Array of expected tokens at parse failure point
 */
export class Expectations extends Array<string> {
  toString(): string;
}

/**
 * Stats - For collecting parse statistics
 */
export class Stats {
  constructor();
  displayStats(): string;
}

/**
 * Parse options
 */
export interface ParseOptions<T extends Translator | null = Translator | null> {
  /** Grammar rule to start parsing from. Defaults to 'condition'. */
  readonly startRule?: string;
  readonly stats?: boolean;
  readonly trace?: boolean;
  readonly translator?: T;
}

/**
 * Parse result metadata
 */
export interface ParseResultMeta {
  readonly success: boolean;
  readonly state: number;
  readonly stateName: string;
  readonly length: number;
  readonly matched: number;
  readonly maxMatched: number;
  readonly maxTreeDepth: number;
  readonly nodeHits: number;
}

/**
 * Parse result
 */
export interface ParseResult<T = CSTNode | ConditionAST | undefined> {
  readonly result: ParseResultMeta;
  readonly tree: T;
  readonly stats: Stats | undefined;
  readonly trace: Trace | undefined;
}

/**
 * Parse a "simple" criterion condition with ASTTranslator (default).
 */
export function parse(
  condition: string,
  options?: ParseOptions<ASTTranslator>,
): ParseResult<ConditionAST>;
export function parse(
  condition: string,
  options: ParseOptions<CSTTranslator>,
): ParseResult<CSTNode>;
export function parse(condition: string, options: ParseOptions<null>): ParseResult<undefined>;

/**
 * Test whether a string is a valid "simple" criterion condition.
 */
export function test(condition: string): boolean;

/**
 * Resolver: given a runtime expression string and its parsed sub-AST,
 * return its concrete value.
 */
export type Resolver = (expression: string, ast: RuntimeExpressionAST) => unknown;

export interface EvaluateOptions {
  readonly resolve: Resolver;
}

/**
 * Evaluate a "simple" criterion condition against caller-supplied values.
 */
export function evaluate(condition: string, options: EvaluateOptions): boolean;

/**
 * Grammar - ABNF grammar for "simple" criterion conditions
 */
export class Grammar {
  constructor();
  grammarObject: string;
  rules: Rule[];
  udts: UDT[];
  toString(): string;
}

export interface Rule {
  name: string;
  lower: string;
  index: number;
  isBkr: boolean;
  opcodes?: Opcode[];
}

export type Opcode =
  | { type: 1; children: number[] }
  | { type: 2; children: number[] }
  | { type: 3; min: number; max: number }
  | { type: 4; index: number }
  | { type: 5; min: number; max: number }
  | { type: 6 | 7; string: number[] };

export type UDT = Record<string, never>;

export interface ArazzoCriterionErrorOptions extends ErrorOptions {
  [key: string]: unknown;
}

export class ArazzoCriterionError extends Error {
  constructor(message?: string, options?: ArazzoCriterionErrorOptions);
  override name: string;
  override cause?: unknown;
}

export class ArazzoCriterionParseError extends ArazzoCriterionError {
  condition?: string;
}

export class ArazzoCriterionEvaluateError extends ArazzoCriterionError {
  condition?: string;
}
