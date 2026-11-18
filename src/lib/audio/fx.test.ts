import { describe, expect, it } from 'vitest';
import { FX_KNOBS_OFF, crushSettings, filterSettings, knobsToParams, pumpDepthDb, randomKnobs, spaceToParams, wobbleSettings } from './fx';
import { Rng } from './rng';

describe('effects rack', () => {
  it('sounds as before with every rack knob off', () => {
    for (const space of [0, 35, 70, 100]) {
      const p = knobsToParams(space, FX_KNOBS_OFF);
      const old = spaceToParams(space / 100);
      for (const k of Object.keys(old) as (keyof typeof old)[]) expect(p[k]).toBeCloseTo(old[k] as number, 6);
      expect([p.crush, p.filter, p.wobble, p.pump]).toEqual([0, 0, 0, 0]);
    }
  });

  it('leaves the sound alone at 0', () => {
    expect(crushSettings(0).mix).toBe(0);
    expect(crushSettings(0).drive).toBeLessThan(0.1);
    expect(filterSettings(0)).toMatchObject({ lp: 20000, hp: 20 });
    expect(filterSettings(0.03)).toMatchObject({ lp: 20000, hp: 20 });
    expect(wobbleSettings(0, 90)).toMatchObject({ wet: 0, dry: 1, feedback: 0 });
    expect(pumpDepthDb(0.1)).toBe(0);
  });

  it('turns each knob up to something strong', () => {
    expect(crushSettings(1).mix).toBe(1);
    expect(filterSettings(-1).lp).toBeCloseTo(250);
    expect(filterSettings(1).hp).toBeCloseTo(2500);
    expect(wobbleSettings(1, 120).rate).toBeCloseTo(1); // one sweep per two beats
    expect(pumpDepthDb(1)).toBe(15);
    const e = knobsToParams(0, { ...FX_KNOBS_OFF, echo: 100, echoTime: 4 });
    expect(e.delayMix).toBeGreaterThan(0.5);
    expect(e.delayFeedback).toBeGreaterThan(0.8);
    expect(e.delaySteps).toBe(4);
  });

  it('RANDOMIZE! always moves at least two knobs clearly, and sometimes leaves some off', () => {
    const rng = new Rng(5);
    let now = { ...FX_KNOBS_OFF };
    let offs = 0;
    let wild = 0;
    for (let i = 0; i < 300; i++) {
      const k = randomKnobs(now, () => rng.next());
      const moved = (['crush', 'filter', 'wobble', 'echo', 'pump'] as const).filter((n) => Math.abs(k[n] - now[n]) >= 25);
      expect(moved.length).toBeGreaterThanOrEqual(2);
      expect([2, 3, 4]).toContain(k.echoTime);
      expect(Math.abs(k.filter)).toBeLessThanOrEqual(95);
      offs += [k.crush, k.wobble, k.echo, k.pump].filter((v) => v === 0).length;
      if ([k.crush, k.wobble, k.echo, k.pump].filter((v) => v >= 55).length >= 3) wild++;
      now = k;
    }
    expect(offs).toBeGreaterThan(100);
    expect(wild).toBeGreaterThan(20);
  });
});
