/**
 * Popover collision handling for the language menu — pure (no DOM reads, no
 * React) so it is unit-testable with plain numbers.
 *
 * The menu is positioned by CSS (under or over its trigger, aligned to the
 * trigger's inline-start or inline-end edge). This module only decides
 * whether that preferred placement fits the viewport, and if not, which of
 * the alternatives to use: flip to the other side, flip the alignment, then
 * shift horizontally to keep a gutter.
 */

export type MenuSide = 'bottom' | 'top';
export type MenuAlign = 'start' | 'end';

export interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlacementInput {
  trigger: Box;
  /** The popover's size — independent of where it is placed. */
  popover: { width: number; height: number };
  viewport: { width: number; height: number };
  side: MenuSide;
  align: MenuAlign;
  /** Page direction: `'end'` is the right edge in `ltr` and the left edge in `rtl`. */
  dir: 'ltr' | 'rtl';
  /** Space kept between the popover and the viewport edge. */
  gutter?: number;
  /** Gap between the trigger and the popover. */
  offset?: number;
}

export interface Placement {
  side: MenuSide;
  align: MenuAlign;
  /** Horizontal correction in px, in the physical direction (positive = right). */
  shift: number;
  /** Room on the chosen side in px: the popover's height cap. */
  available: number;
}

const DEFAULT_GUTTER = 16;
const DEFAULT_OFFSET = 8;

/** Left edge of the popover for an alignment. */
function leftFor(align: MenuAlign, dir: 'ltr' | 'rtl', trigger: Box, width: number): number {
  const rightEdgeAligned = (align === 'end') === (dir === 'ltr');
  return rightEdgeAligned ? trigger.right - width : trigger.left;
}

/** Overflow (px) of a left edge past the gutters, 0 when it fits. */
function overflow(left: number, width: number, viewportWidth: number, gutter: number): number {
  if (left < gutter) return gutter - left;
  if (left + width > viewportWidth - gutter) return viewportWidth - gutter - (left + width);
  return 0;
}

export function computePlacement(input: PlacementInput): Placement {
  const { trigger, popover, viewport, dir } = input;
  const gutter = input.gutter ?? DEFAULT_GUTTER;
  const offset = input.offset ?? DEFAULT_OFFSET;

  const room = {
    bottom: viewport.height - trigger.bottom - offset - gutter / 2,
    top: trigger.top - offset - gutter / 2,
  };
  const other: MenuSide = input.side === 'bottom' ? 'top' : 'bottom';
  const side =
    popover.height <= room[input.side] || room[input.side] >= room[other] ? input.side : other;

  const otherAlign: MenuAlign = input.align === 'end' ? 'start' : 'end';
  const preferred = overflow(leftFor(input.align, dir, trigger, popover.width), popover.width, viewport.width, gutter);
  let align = input.align;
  let shift = preferred;
  if (preferred !== 0) {
    const alternative = overflow(leftFor(otherAlign, dir, trigger, popover.width), popover.width, viewport.width, gutter);
    if (alternative === 0) {
      align = otherAlign;
      shift = 0;
    } else if (Math.abs(alternative) < Math.abs(preferred)) {
      align = otherAlign;
      shift = alternative;
    }
  }

  return { side, align, shift, available: Math.max(0, Math.floor(room[side])) };
}
