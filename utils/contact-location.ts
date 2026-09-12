import type { ContactBlockData } from '../types/block';

const HOURS_RANGE = /^\s*(\d{1,2})(?::(\d{2}))?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*$/i;

function parseCoordinate(value: number | string | null | undefined, minimum: number, maximum: number): number | null {
  const coordinate = typeof value === 'string' ? Number(value) : value;
  return typeof coordinate === 'number' && Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
}

export function normalizeContactHours(hours?: string): string | undefined {
  const value = hours?.trim();
  if (!value) return undefined;

  const match = value.match(HOURS_RANGE);
  if (!match) return value;

  const start = `${match[1].padStart(2, '0')}:${(match[2] ?? '00').padStart(2, '0')}`;
  const end = `${match[3].padStart(2, '0')}:${(match[4] ?? '00').padStart(2, '0')}`;
  return start === end ? 'Open 24 hours' : value;
}

export function getContactPresentation(data: ContactBlockData): {
  hasContactFacts: boolean;
  mapSrc: string | null;
  directionsUrl: string | null;
  hours: string | undefined;
} {
  const address = data.address?.trim();
  const latitude = parseCoordinate(data.map_lat, -90, 90);
  const longitude = parseCoordinate(data.map_lng, -180, 180);
  const hasCoordinates = latitude !== null && longitude !== null;
  const explicitMapEmbed = data.map_embed_url?.trim() || null;
  const mapSrc = explicitMapEmbed
    ?? (hasCoordinates ? `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}&output=embed` : null);
  const directionsUrl = data.cta_url ?? (address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}` : null);
  const hours = normalizeContactHours(data.hours);
  const hasContactFacts = Boolean(
    address || data.email || data.phone || hours || explicitMapEmbed || hasCoordinates || data.socials?.length,
  );

  return { hasContactFacts, mapSrc, directionsUrl, hours };
}
