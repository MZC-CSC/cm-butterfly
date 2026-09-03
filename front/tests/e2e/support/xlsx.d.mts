/**
 * Type for the plain-JavaScript builder next to this file.
 *
 * ★ The builder is JavaScript rather than TypeScript because two things call it: the tests, and
 *   the Windows recording scripts, which run under plain node with nothing to compile with. One
 *   implementation with a type beside it keeps the two from drifting.
 */
export declare function buildXlsx(rows: string[][]): Buffer;
