import { describe, it, expect } from 'vitest'
import { repairJsonString } from './json-repair'

const VALID = '{"meta":{"topic":"t","slug":"s"}}'
const NL = String.fromCharCode(10)
const TAB = String.fromCharCode(9)
const BEL = String.fromCharCode(7)
const NUL = String.fromCharCode(0)

/** Serialise a value, then re-introduce a trailing comma before the close. */
const withTrailingComma = (value: unknown) => JSON.stringify(value).slice(0, -1) + ',}'

describe('repairJsonString - conservative (job completion)', () => {
  it('reports valid input as valid without repairing', () => {
    expect(repairJsonString(VALID)).toEqual({ valid: true })
  })

  it('strips trailing commas before } and ]', () => {
    const r = repairJsonString('{"a":[1,2,],"b":{"c":1,},}')
    expect(r.valid).toBe(true)
    expect(r.repaired).toBe(true)
    expect(JSON.parse(r.fixed as string)).toEqual({ a: [1, 2], b: { c: 1 } })
  })

  it('strips raw control characters that are never legal in a JSON string', () => {
    const r = repairJsonString('{"a":"x' + BEL + 'y' + NUL + 'z"}')
    expect(r.valid).toBe(true)
    expect(JSON.parse(r.fixed as string)).toEqual({ a: 'xyz' })
  })

  it('leaves properly escaped whitespace alone', () => {
    const value = 'line1' + NL + 'line2' + TAB + 'tab'
    const r = repairJsonString(withTrailingComma({ a: value }))
    expect(r.valid).toBe(true)
    expect(JSON.parse(r.fixed as string)).toEqual({ a: value })
  })

  it('does not fix a raw newline inside a string - that needs the aggressive pass', () => {
    expect(repairJsonString('{"a":"one' + NL + 'two"}').valid).toBe(false)
  })

  it('does NOT truncate a cut-off document - that would silently drop data', () => {
    const r = repairJsonString('{"meta":{"topic":"t"},"overview":')
    expect(r.valid).toBe(false)
    expect(r.error).toBeTruthy()
  })

  it('preserves non-ASCII content', () => {
    const topic = '量子コンピューティング'
    const r = repairJsonString(withTrailingComma({ topic }))
    expect(r.valid).toBe(true)
    expect(JSON.parse(r.fixed as string).topic).toBe(topic)
  })

  it('gives up on input that is not JSON at all', () => {
    expect(repairJsonString('I could not complete the research task.').valid).toBe(false)
  })
})

describe('repairJsonString - aggressive (explicit user repair)', () => {
  it('escapes a raw newline inside a string value', () => {
    const r = repairJsonString('{"a":"one' + NL + 'two"}', { aggressive: true })
    expect(r.valid).toBe(true)
    expect(JSON.parse(r.fixed as string).a).toBe('one' + NL + 'two')
  })

  it('still repairs the conservative cases too', () => {
    const r = repairJsonString('{"a":[1,2,],}', { aggressive: true })
    expect(r.valid).toBe(true)
    expect(JSON.parse(r.fixed as string)).toEqual({ a: [1, 2] })
  })

  it('reports unrepairable garbage as invalid', () => {
    expect(repairJsonString('<<<not json>>>', { aggressive: true }).valid).toBe(false)
  })

  // Known defect, tracked in issue #44. Truncation recovery only runs when the
  // parser says "Unexpected end of JSON input", and even then it walks back to
  // a '}' that always leaves the root object unclosed. None of the shapes real
  // CLI truncation produces are recovered. These assertions pin the current
  // (broken) behaviour so the fix for #44 shows up as a visible change.
  const truncationShapes: [string, string][] = [
    ['truncated after a key', '{"meta":{"a":1},"overview":'],
    ['truncated mid-string', '{"meta":{"a":1},"ov":{"s":"ha'],
    ['missing only the final brace', '{"meta":{"a":1},"ov":{"s":"x"}'],
    ['truncated after a value', '{"meta":{"a":1},"ov":2'],
    ['array root truncated', '[{"a":1},{"b"'],
  ]

  it.each(truncationShapes)('does not yet recover: %s (#44)', (_name, raw) => {
    expect(repairJsonString(raw, { aggressive: true }).valid).toBe(false)
  })
})
