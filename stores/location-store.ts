'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformScopedStorage } from '../sdk/platform';

const DEFAULT_LAT = 4.77149;
const DEFAULT_LNG = 7.01435;

interface LocationState {
  latitude: number;
  longitude: number;
  address: string;
  stateId: string | null;
  setLocation: (lat: number, lng: number, address: string, stateId?: string | null) => void;
  clearLocation: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LNG,
      address: '',
      stateId: null,
      setLocation: (latitude, longitude, address, stateId = null) =>
        set({ latitude, longitude, address, stateId }),
      clearLocation: () =>
        set({ latitude: DEFAULT_LAT, longitude: DEFAULT_LNG, address: '', stateId: null }),
    }),
    {
      name: 'queek-storefront-location',
      storage: createJSONStorage(platformScopedStorage),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<LocationState>),
        stateId: (persisted as Partial<LocationState>)?.stateId ?? null,
      }),
    },
  ),
);
