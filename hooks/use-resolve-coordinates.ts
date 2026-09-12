'use client';

import { useState } from 'react';
import { useStorefront } from '../provider';
import { getQueekClient } from '../sdk/queek-client';
import { useLocationStore } from '../stores/location-store';

interface CoordinatesResponse {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  formatted_address?: string;
  state_id?: string | null;
}

export function useResolveCoordinates(): {
  resolve: (placeId: string, description: string) => Promise<boolean>;
  resolving: boolean;
} {
  const { vendor } = useStorefront();
  const setLocation = useLocationStore((s) => s.setLocation);
  const [resolving, setResolving] = useState(false);

  const resolve = async (placeId: string, description: string): Promise<boolean> => {
    setResolving(true);
    try {
      const client = getQueekClient(vendor.slug ?? undefined);
      const res = await client.post<CoordinatesResponse>('/client/geo/resolve', {
        place_id: placeId,
      });
      const data = (res?.data ?? {}) as CoordinatesResponse;
      const lat = data.lat ?? data.latitude;
      const lng = data.lng ?? data.longitude;
      if (typeof lat === 'number' && typeof lng === 'number') {
        setLocation(lat, lng, data.formatted_address ?? description, data.state_id ?? null);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setResolving(false);
    }
  };

  return { resolve, resolving };
}
