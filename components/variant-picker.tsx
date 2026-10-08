'use client';

import type { JSX } from 'react';
import type { Product, ProductVariant } from '../types/product';
import './variant-picker.css';

interface VariantPickerProps {
  product: Product;
  selectedOptions: Record<string, string>;
  onSelect: (optionName: string, value: string) => void;
  className?: string;
}

/**
 * Renders a product's option groups as color swatch / image swatch / text
 * buttons — standard e-commerce priority: color_code first, else a
 * representative image, else plain text. Shared by every surface that needs
 * an option picker (quick-add, the QR ordering sheet, a theme's quick-view
 * modal) instead of each re-implementing it. Pair with `matchVariant()`
 * (utils/match-variant.ts) to resolve `selectedOptions` into a real
 * `ProductVariant`, and gate the add action on that being non-null before
 * calling `addProduct`/`addItemWithAddons` — a variant-enabled product added
 * without one fails the cart save server-side rather than merely being "no
 * variant"; there is no valid no-selection state to fall back to.
 */
export function VariantPicker({ product, selectedOptions, onSelect, className }: VariantPickerProps): JSX.Element | null {
  if (product.options.length === 0) return null;

  return (
    <div className={className}>
      {product.options.map((option) => {
        const isColor = option.type === 'color' || option.values.some((v) => v.color_code);
        const selectedValue = selectedOptions[option.name];

        return (
          <div className="qk-variant-option" key={option.name}>
            <span className="qk-variant-option__label">
              {option.name}
              {selectedValue ? (
                <span className="qk-variant-option__selected">
                  {option.values.find((v) => v.value === selectedValue)?.label ?? selectedValue}
                </span>
              ) : null}
            </span>
            <div className="qk-variant-option__values">
              {option.values.map((val) => {
                const isSelected = selectedValue === val.value;
                const handleSelect = (): void => onSelect(option.name, val.value);

                if (isColor && val.color_code) {
                  return (
                    <button
                      key={val.value}
                      type="button"
                      className={`qk-variant-swatch${isSelected ? ' is-selected' : ''}`}
                      style={{ background: val.color_code }}
                      title={val.label}
                      aria-label={val.label}
                      onClick={handleSelect}
                    />
                  );
                }

                if (val.image) {
                  return (
                    <button
                      key={val.value}
                      type="button"
                      className={`qk-variant-swatch qk-variant-swatch--image${isSelected ? ' is-selected' : ''}`}
                      title={val.label}
                      aria-label={val.label}
                      onClick={handleSelect}
                    >
                      <img src={val.image} alt={val.label} />
                    </button>
                  );
                }

                return (
                  <button
                    key={val.value}
                    type="button"
                    className={`qk-variant-option__btn${isSelected ? ' is-selected' : ''}`}
                    onClick={handleSelect}
                  >
                    {val.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** True once every one of the product's option groups has a selected value —
 *  the gate to check alongside `matchVariant(...) !== null` before allowing
 *  an add. Centralized so both call sites stay in sync on the definition. */
export function allVariantOptionsSelected(product: Product, selectedOptions: Record<string, string>): boolean {
  return product.options.every((option) => Boolean(selectedOptions[option.name]));
}

export type { ProductVariant };
