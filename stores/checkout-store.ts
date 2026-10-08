'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformScopedStorage } from '../sdk/platform';

export interface ScheduleSlot {
  id: string;
  date: string;
  min_time: string;
  max_time: string;
  time?: string;
}

export type CheckoutTab = 'summary' | 'checkout';
export type DeliveryType = 'instant' | 'schedule';

/** The Shipbubble courier the customer picked. Its price is re-derived from the
 *  server-cached quote (via request_token + service_code) at fee/order time —
 *  never trusted from the client — so display == charge. */
export interface ShipbubbleSelection {
  request_token: string;
  service_code: string;
  courier_id: string;
}

/** Which of the vendor's (possibly several) active bank accounts the customer
 *  picked for a bank_transfer order — submitted with checkout and re-verified
 *  server-side against the vendor's real accounts before it's ever recorded. */
export interface SelectedBankAccount {
  bank_name: string;
  bank_code: string;
  account_name: string;
  account_number: string;
}

interface CheckoutState {
  deliveryMode: string | null;
  deliveryType: DeliveryType;
  selectedSlot: ScheduleSlot | null;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  selectedBankAccount: SelectedBankAccount | null;
  /** instore_qr dine-in only — which of the vendor's tables the customer is
   *  sitting at (App\Models\VendorTable id). Null for every other flow. */
  selectedTableId: string | null;
  promoCode: string;
  vendorNote: string;
  riderNote: string;
  activeTab: CheckoutTab;
  /** Selected delivery source when two options (queek/vendor) are available */
  deliverySource: string | null;
  /** Shipping zone UUID — required for a MANUAL shipping order */
  shippingZoneId: string | null;
  shippingZoneName: string | null;
  /** The picked Shipbubble courier for an AUTOMATED shipping order (transient) */
  shipbubbleSelection: ShipbubbleSelection | null;
  /** Total order weight in kg — needed when selected zone has has_weight_pricing: true */
  weightKg: number | null;
  /** Transient (not persisted). When true, checkout will auto-resume
   *  to the checkout tab once the user authenticates. Set by the
   *  controller when a guest clicks "Proceed to checkout". */
  pendingAuthResume: boolean;
  /** Transient. True while the customer is searching/changing their delivery
   *  address — the resolved fee is stale then, so surfaces hide it. */
  isEditingAddress: boolean;
  /** The customer's saved address (CustomerAddress uuid) currently selected for
   *  delivery, when they picked one from their address book instead of
   *  searching a fresh address. Lets the API reuse the cached courier
   *  geocode. Null whenever the address came from a fresh Google search. */
  savedAddressId: string | null;

  setDeliveryMode: (mode: string | null) => void;
  setDeliveryType: (type: DeliveryType) => void;
  setSelectedSlot: (slot: ScheduleSlot | null) => void;
  setPaymentMethod: (id: string | null, name: string | null) => void;
  setSelectedBankAccount: (account: SelectedBankAccount | null) => void;
  setSelectedTableId: (tableId: string | null) => void;
  setPromoCode: (code: string) => void;
  setVendorNote: (note: string) => void;
  setRiderNote: (note: string) => void;
  setActiveTab: (tab: CheckoutTab) => void;
  setDeliverySource: (source: string | null) => void;
  setShippingZone: (id: string | null, name: string | null) => void;
  setShipbubbleSelection: (selection: ShipbubbleSelection | null) => void;
  setWeightKg: (weight: number | null) => void;
  setPendingAuthResume: (value: boolean) => void;
  setEditingAddress: (value: boolean) => void;
  setSavedAddressId: (id: string | null) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      deliveryMode: null,
      deliveryType: 'instant',
      selectedSlot: null,
      paymentMethodId: null,
      paymentMethodName: null,
      selectedBankAccount: null,
      selectedTableId: null,
      promoCode: '',
      vendorNote: '',
      riderNote: '',
      activeTab: 'summary',
      deliverySource: null,
      shippingZoneId: null,
      shippingZoneName: null,
      shipbubbleSelection: null,
      weightKg: null,
      pendingAuthResume: false,
      isEditingAddress: false,
      savedAddressId: null,

      setDeliveryMode: (deliveryMode) => set({ deliveryMode, deliverySource: null, shippingZoneId: null, shippingZoneName: null, shipbubbleSelection: null }),
      setDeliveryType: (deliveryType) => set({ deliveryType }),
      setSelectedSlot: (selectedSlot) => set({ selectedSlot }),
      // Changing the method invalidates a bank choice made for the previous one.
      setPaymentMethod: (paymentMethodId, paymentMethodName) => set({ paymentMethodId, paymentMethodName, selectedBankAccount: null }),
      setSelectedBankAccount: (selectedBankAccount) => set({ selectedBankAccount }),
      setSelectedTableId: (selectedTableId) => set({ selectedTableId }),
      setPromoCode: (promoCode) => set({ promoCode }),
      setVendorNote: (vendorNote) => set({ vendorNote }),
      setRiderNote: (riderNote) => set({ riderNote }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setDeliverySource: (deliverySource) => set({ deliverySource }),
      setShippingZone: (shippingZoneId, shippingZoneName) => set({ shippingZoneId, shippingZoneName }),
      setShipbubbleSelection: (shipbubbleSelection) => set({ shipbubbleSelection }),
      setWeightKg: (weightKg) => set({ weightKg }),
      setPendingAuthResume: (pendingAuthResume) => set({ pendingAuthResume }),
      setEditingAddress: (isEditingAddress) => set({ isEditingAddress }),
      setSavedAddressId: (savedAddressId) => set({ savedAddressId }),
      reset: () => set({
        deliveryMode: null,
        deliveryType: 'instant',
        selectedSlot: null,
        selectedBankAccount: null,
        selectedTableId: null,
        promoCode: '',
        vendorNote: '',
        riderNote: '',
        activeTab: 'summary',
        deliverySource: null,
        shippingZoneId: null,
        shipbubbleSelection: null,
        shippingZoneName: null,
        weightKg: null,
        pendingAuthResume: false,
        isEditingAddress: false,
        savedAddressId: null,
      }),
    }),
    {
      name: 'queek-storefront-checkout',
      storage: createJSONStorage(platformScopedStorage),
      partialize: (state) => ({
        deliveryMode: state.deliveryMode,
        deliveryType: state.deliveryType,
        selectedSlot: state.selectedSlot,
        paymentMethodId: state.paymentMethodId,
        paymentMethodName: state.paymentMethodName,
        selectedTableId: state.selectedTableId,
      }),
    },
  ),
);
