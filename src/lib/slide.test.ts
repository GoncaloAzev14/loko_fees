import { describe, expect, it } from 'vitest'
import { CONFIRM_AT, clamp, isConfirmed, isTap, knobPosition, progress } from './slide'

describe('knobPosition', () => {
  it('follows the finger from where the knob started', () => {
    expect(knobPosition(0, 80, 280)).toBe(80)
    expect(knobPosition(40, 60, 280)).toBe(100)
  })

  it('stays on the track: never before the start or past the end', () => {
    expect(knobPosition(0, -50, 280)).toBe(0)
    expect(knobPosition(200, 500, 280)).toBe(280)
  })

  it('stays at the start on a track with no room', () => {
    expect(knobPosition(0, 100, 0)).toBe(0)
    expect(knobPosition(0, 100, -10)).toBe(0)
  })
})

describe('isConfirmed', () => {
  it('confirms only when let go far enough along', () => {
    expect(isConfirmed(280, 280)).toBe(true)
    expect(isConfirmed(280 * CONFIRM_AT, 280)).toBe(true)
    expect(isConfirmed(280 * CONFIRM_AT - 1, 280)).toBe(false)
    expect(isConfirmed(100, 280)).toBe(false)
    expect(isConfirmed(0, 280)).toBe(false)
  })

  it('never confirms on a track with no room', () => {
    expect(isConfirmed(0, 0)).toBe(false)
    expect(isConfirmed(5, 0)).toBe(false)
  })
})

describe('progress', () => {
  it('runs from 0 to 1 and stays inside', () => {
    expect(progress(0, 200)).toBe(0)
    expect(progress(100, 200)).toBe(0.5)
    expect(progress(200, 200)).toBe(1)
    expect(progress(500, 200)).toBe(1)
    expect(progress(-5, 200)).toBe(0)
    expect(progress(10, 0)).toBe(0)
  })
})

describe('isTap', () => {
  it('tells a tap from a slide', () => {
    expect(isTap(0, 280)).toBe(true)
    expect(isTap(5, 280)).toBe(true)
    expect(isTap(40, 280)).toBe(false)
  })

  it('scales down on a short track', () => {
    expect(isTap(5, 40)).toBe(false) // 5 is more than a tenth of 40
  })
})

describe('clamp', () => {
  it('limits a value to a range', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })
})
