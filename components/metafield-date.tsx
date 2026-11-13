'use client';

import { useContext, type JSX } from 'react';
import { StorefrontContext } from '../provider';
import { formatShopperDate } from '../utils/format';
import { storeDisplayFormat } from '../utils/locale';

/**
 * A date metafield is a calendar day: the store's English (or the shopper's language), read in UTC so the day never
 * moves with a zone. A client component (it reads the store from context), so the metafield renderers that place it
 * stay usable from a server component; outside a provider it prints neutral English.
 */
export function MetafieldDate({ time }: { time: number }): JSX.Element {
  const context = useContext(StorefrontContext);
  const locale = context ? (context.display ?? storeDisplayFormat(context.locale, context.vendor)).locale : null;
  return <>{formatShopperDate(time, locale, {}, 'UTC')}</>;
}
