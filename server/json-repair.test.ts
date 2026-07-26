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

  // The shapes real CLI truncation produces (#44). Before the fix none of
  // these recovered: the strategy only ran on "Unexpected end of JSON input"
  // and walked back to a '}' that left the root object unclosed.
  const truncationShapes: [string, string, unknown][] = [
    ['truncated after a key', '{"meta":{"a":1},"overview":', { meta: { a: 1 } }],
    ['truncated mid-string', '{"meta":{"a":1},"ov":{"s":"ha', { meta: { a: 1 }, ov: { s: 'ha' } }],
    ['missing only the final brace', '{"meta":{"a":1},"ov":{"s":"x"}', { meta: { a: 1 }, ov: { s: 'x' } }],
    ['truncated after a value', '{"meta":{"a":1},"ov":2', { meta: { a: 1 }, ov: 2 }],
    ['array root truncated', '[{"a":1},{"b"', [{ a: 1 }]],
    ['truncated mid-key', '{"a":1,"titl', { a: 1 }],
    ['trailing commentary after the root', '{"a":1}' + NL + NL + 'I ran out of turns.', { a: 1 }],
    ['truncated inside a nested array', '{"a":[1,2,3', { a: [1, 2, 3] }],
    ['truncated on a dangling escape', '{"a":"x\\', { a: 'x' }],
    ['truncated inside a unicode escape', '{"a":"x\\u00', { a: 'x' }],
  ]

  it.each(truncationShapes)('recovers: %s (#44)', (_name, raw, expected) => {
    const r = repairJsonString(raw, { aggressive: true })
    expect(r.valid).toBe(true)
    expect(r.truncated).toBe(true)
    expect(JSON.parse(r.fixed as string)).toEqual(expected)
  })

  it('reports how much the recovery dropped', () => {
    const r = repairJsonString('{"meta":{"a":1},"overview":"' + 'x'.repeat(50), { aggressive: true })
    expect(r.valid).toBe(true)
    // The tail was inside a string, so closing it kept everything.
    expect(r.droppedChars).toBe(0)

    const r2 = repairJsonString('{"meta":{"a":1},"overview":', { aggressive: true })
    expect(r2.droppedChars).toBe('"overview":'.length + 1) // + the separating comma
  })

  it('does not flag a non-truncation repair as truncated', () => {
    const r = repairJsonString('{"a":[1,2,],}', { aggressive: true })
    expect(r.valid).toBe(true)
    expect(r.truncated).toBeUndefined()
  })

  it('refuses to salvage a document with nothing complete at the root', () => {
    // Recovery here could only produce '{}', which would silently replace the
    // topic with an empty document.
    expect(repairJsonString('{"meta":{"topic":', { aggressive: true }).valid).toBe(false)
    expect(repairJsonString('{"meta', { aggressive: true }).valid).toBe(false)
  })

  it('keeps the completed part of a realistic cut-off document', () => {
    const raw = JSON.stringify({
      meta: { topic: '量子コンピューティング', slug: 'quantum' },
      sections: [{ title: 'A', body: 'done' }],
    })
    // Cut mid-way through a second section, the way --max-turns leaves it.
    const cut = raw.slice(0, raw.lastIndexOf(']')) + ',{"title":"B","body":"半分だけ書'
    const r = repairJsonString(cut, { aggressive: true })
    expect(r.valid).toBe(true)
    const doc = JSON.parse(r.fixed as string)
    expect(doc.meta.topic).toBe('量子コンピューティング')
    expect(doc.sections).toEqual([
      { title: 'A', body: 'done' },
      { title: 'B', body: '半分だけ書' },
    ])
  })
})
