import { describe, expect, it } from 'vitest';
import { computePlacement, type PlacementInput } from '../utils/menu-placement';

const VIEW = { width: 1000, height: 800 };
const POP = { width: 240, height: 300 };

function place(over: Partial<PlacementInput> & Pick<PlacementInput, 'trigger'>) {
  return computePlacement({ popover: POP, viewport: VIEW, side: 'bottom', align: 'end', dir: 'ltr', ...over });
}

/** A 100x44 trigger whose top-left is (left, top). */
const box = (left: number, top: number) => ({ left, top, right: left + 100, bottom: top + 44 });

describe('computePlacement', () => {
  it('keeps the preferred placement when it fits', () => {
    expect(place({ trigger: box(700, 10) })).toMatchObject({ side: 'bottom', align: 'end', shift: 0 });
  });

  it('flips up when there is no room below and more above', () => {
    const p = place({ trigger: box(700, 600) });
    expect(p.side).toBe('top');
    expect(p.available).toBe(600 - 8 - 8);
  });

  it('footers opening up flip down when there is no room above', () => {
    expect(place({ trigger: box(700, 20), side: 'top' }).side).toBe('bottom');
    expect(place({ trigger: box(700, 600), side: 'top' }).side).toBe('top');
  });

  it('keeps the side with more room (and caps the height) when neither fits', () => {
    const p = place({ trigger: box(700, 300), popover: { width: 240, height: 700 } });
    expect(p.side).toBe('bottom');
    expect(p.available).toBe(800 - 344 - 8 - 8);
  });

  it('aligns to the trigger end (right edge in ltr) and flips alignment on overflow', () => {
    // end: left = 800 - 240 = 560, fits.
    expect(place({ trigger: box(700, 10) })).toMatchObject({ align: 'end', shift: 0 });
    // trigger near the left edge: end would start at 40 - 140 < 16; start fits.
    expect(place({ trigger: box(40, 10) })).toMatchObject({ align: 'start', shift: 0 });
  });

  it('mirrors in rtl: end is the left edge', () => {
    // rtl end: left = trigger.left = 40 fits.
    expect(place({ trigger: box(40, 10), dir: 'rtl' })).toMatchObject({ align: 'end', shift: 0 });
    // trigger at the right edge: rtl end would overflow; start (right edge aligned) fits.
    expect(place({ trigger: box(880, 10), dir: 'rtl' })).toMatchObject({ align: 'start', shift: 0 });
  });

  it('shifts into the gutter when neither alignment fits', () => {
    // 240 wide in a 260 viewport, trigger in the middle: both overflow somewhere.
    const p = computePlacement({
      trigger: box(80, 10),
      popover: { width: 240, height: 100 },
      viewport: { width: 260, height: 800 },
      side: 'bottom',
      align: 'end',
      dir: 'ltr',
    });
    // end: left edge at 180 - 240 = -60, shifted +76 to the 16px gutter.
    expect(p).toMatchObject({ align: 'end', shift: 76 });
  });
});
