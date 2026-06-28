import { expect, test } from 'vitest'
import { formatRemaining } from '#/lib/format-remaining.ts'

test('formatRemaining redondea según el umbral', () => {
  expect(formatRemaining(5)).toBe('5 d')
  expect(formatRemaining(30)).toBe('30 d')
  expect(formatRemaining(31)).toBe('1 mes')
  expect(formatRemaining(60)).toBe('2 meses')
  expect(formatRemaining(364)).toBe('12 meses')
  expect(formatRemaining(365)).toBe('1 año')
  expect(formatRemaining(730)).toBe('2 años')
})
