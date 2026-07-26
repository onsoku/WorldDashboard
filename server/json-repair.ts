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
//     discards trailing content and so is only used by the explicit
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
}

export interface RepairOptions {
  /**
   * Enable truncation recovery: when the document ends mid-structure, walk
   * back to the last position that parses. This drops data, so it is opt-in.
   */
  aggressive?: boolean
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
    } catch (e2) {
      if (!opts.aggressive) return { valid: false, error }

      // Truncation recovery: find the latest '}' at which the prefix parses.
      const truncated = e2 instanceof SyntaxError && e2.message.includes('end of JSON input')
      if (!truncated) return { valid: false, error }

      for (let i = fixed.lastIndexOf('}'); i >= 0; i--) {
        if (fixed[i] !== '}') continue
        const candidate = fixed.slice(0, i + 1)
        try {
          JSON.parse(candidate)
          return { valid: true, repaired: true, fixed: candidate, error }
        } catch { /* keep walking back */ }
      }
      return { valid: false, error }
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
