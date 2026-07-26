// Repair for JSON files written by the Claude CLI.
//
// LLM-generated JSON fails in a small number of recurring ways: trailing
// commas, stray control characters, unescaped newlines inside strings, and
// truncation when the model runs out of turns mid-write. Issues #17 and #20
// were both this.
//
// Two entry points on purpose:
//   - repairJsonString(raw)                — conservative, safe to run
//     automatically when a job completes.
//   - repairJsonString(raw, { aggressive }) — adds truncation recovery, which
//     yields an incomplete document and so is only used by the explicit
//     "repair this topic" action the user triggers from the UI.

import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface RepairResult {
  /** True when the input parsed as-is, or when a repair produced valid JSON. */
  valid: boolean
  /** Set when a repair was applied; absent when the input was already valid. */
  repaired?: boolean
  /** The repaired text. Only present when repaired is true. */
  fixed?: string
  /** Parser message from the original failure. */
  error?: string
  /**
   * Set when truncation recovery ran. The document was cut off mid-write, so
   * the result is structurally valid but incomplete — callers should say so.
   */
  truncated?: boolean
  /**
   * Roughly how many characters the recovery could not salvage. Measured
   * against the sanitised text, so it is off by however much the trailing
   * comma / control character passes removed.
   */
  droppedChars?: number
}

export interface RepairOptions {
  /**
   * Enable truncation recovery: when the document ends mid-structure, close
   * the structures that are still open. This can drop the tail, so it is
   * opt-in.
   */
  aggressive?: boolean
}

interface OpenContainer {
  open: '{' | '['
  /** Index just past the opening bracket. */
  openEnd: number
  /**
   * Index of the comma that terminated the last complete member. Slicing the
   * document here yields a container whose contents all parsed. Equal to
   * openEnd while nothing inside has been committed yet.
   */
  commitEnd: number
}

interface Scan {
  stack: OpenContainer[]
  /** The document ends inside a string literal. */
  inString: boolean
  /** The document ends inside an unfinished backslash escape. */
  danglingEscape: boolean
  /** Index just past the root value, or -1 when the root never closed. */
  rootEnd: number
}

/**
 * Walk the document once, tracking string state and the containers that are
 * still open. Everything truncation recovery needs comes out of this: what to
 * close, and where the last complete member ended.
 */
function scanStructure(text: string): Scan {
  const stack: OpenContainer[] = []
  let inString = false
  let escaped = false
  let rootEnd = -1

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') {
        inString = false
        if (stack.length === 0) rootEnd = i + 1
      }
      continue
    }
    if (c === '"') inString = true
    else if (c === '{' || c === '[') stack.push({ open: c, openEnd: i + 1, commitEnd: i + 1 })
    else if (c === '}' || c === ']') {
      stack.pop()
      if (stack.length === 0) rootEnd = i + 1
    } else if (c === ',' && stack.length > 0) {
      stack[stack.length - 1].commitEnd = i
    }
  }

  return { stack, inString, danglingEscape: escaped, rootEnd }
}

const parses = (text: string): boolean => {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

const closersFor = (stack: OpenContainer[]): string =>
  stack.map((c) => (c.open === '{' ? '}' : ']')).reverse().join('')

/** Trim trailing whitespace and a dangling comma so the prefix ends on a value. */
const trimSeparator = (s: string): string => s.replace(/\s+$/, '').replace(/,$/, '')

/**
 * Recover a document that was cut off mid-write — what `--max-turns` produces,
 * and the failure this module exists for (#44).
 *
 * Two attempts, most content first:
 *
 *   1. Keep everything and close what is open: terminate an unfinished string,
 *      then emit the closing brackets for the container stack.
 *   2. Roll back to the last comma-terminated member, innermost container
 *      first. A container with nothing committed is dropped whole rather than
 *      left as an empty `{}`.
 *
 * Both can produce valid-but-wrong JSON — a number cut from `25` to `2` still
 * parses. Callers get `truncated: true` so the user is told the document is
 * incomplete. Recovery that salvages nothing at the root is refused outright:
 * overwriting the file with `{}` is worse than reporting failure.
 */
function recoverTruncated(text: string): { fixed: string; kept: number } | null {
  const scan = scanStructure(text)

  if (scan.stack.length === 0) {
    // Root already closed, so nothing is truncated. The one shape worth
    // fixing here is commentary appended after the JSON.
    if (scan.rootEnd > 0 && scan.rootEnd < text.length) {
      const candidate = text.slice(0, scan.rootEnd)
      if (parses(candidate)) return { fixed: candidate, kept: scan.rootEnd }
    }
    return null
  }

  let head = text
  if (scan.inString) {
    if (scan.danglingEscape) head = head.slice(0, -1)
    // A \uXXXX escape cut short cannot be completed, only dropped. An even
    // run of backslashes means the `u` is literal text, so leave it.
    head = head.replace(/(\\+)u[0-9a-fA-F]{0,3}$/, (m, slashes: string) =>
      slashes.length % 2 === 1 ? '' : m)
  } else {
    head = trimSeparator(head)
  }
  const completed = head + (scan.inString ? '"' : '') + closersFor(scan.stack)
  if (parses(completed)) return { fixed: completed, kept: head.length }

  for (let d = scan.stack.length - 1; d >= 0; d--) {
    const container = scan.stack[d]
    if (container.commitEnd === container.openEnd) {
      // Nothing complete inside this one. At the root that means the whole
      // document is unsalvageable; deeper down, drop the container itself.
      if (d === 0) break
      continue
    }
    const prefix = trimSeparator(text.slice(0, container.commitEnd))
    const candidate = prefix + closersFor(scan.stack.slice(0, d + 1))
    if (parses(candidate)) return { fixed: candidate, kept: prefix.length }
  }

  return null
}

export function repairJsonString(raw: string, opts: RepairOptions = {}): RepairResult {
  try {
    JSON.parse(raw)
    return { valid: true }
  } catch (e) {
    const error = e instanceof SyntaxError ? e.message : String(e)

    let fixed = raw
    // Trailing commas before a closing brace/bracket.
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
    // Control characters that are never legal raw inside a JSON string.
    // \n, \r and \t are excluded — those are handled below, or already escaped.
    // eslint-disable-next-line no-control-regex -- matching raw control bytes is the point
    fixed = fixed.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')

    if (opts.aggressive) {
      // Unescaped newline inside a string value.
      fixed = fixed.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, '\\n')
    }

    try {
      JSON.parse(fixed)
      return { valid: true, repaired: true, fixed, error }
    } catch {
      if (!opts.aggressive) return { valid: false, error }

      const recovered = recoverTruncated(fixed)
      if (!recovered) return { valid: false, error }

      return {
        valid: true,
        repaired: true,
        truncated: true,
        droppedChars: Math.max(0, fixed.length - recovered.kept),
        fixed: recovered.fixed,
        error,
      }
    }
  }
}

/**
 * Validate a file on disk, writing the repaired text back when a repair
 * succeeds. Returns valid:false with an error when the file is missing or
 * beyond repair.
 */
export function repairJsonFile(filePath: string, opts: RepairOptions = {}): RepairResult {
  if (!existsSync(filePath)) return { valid: false, error: 'File not found' }
  const raw = readFileSync(filePath, 'utf-8')
  const result = repairJsonString(raw, opts)
  if (result.repaired && result.fixed !== undefined) {
    writeFileSync(filePath, result.fixed, 'utf-8')
  }
  return result
}
