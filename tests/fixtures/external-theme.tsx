// A real theme, written the way an external developer would, against the
// PUBLISHED package only — no access to any host app.
import type { JSX } from 'react';
import type { ThemeModule, HeaderProps, FooterProps } from '@usequeek/theme-kit/types/theme';
import type { Product } from '@usequeek/theme-kit/types/product';
import { useCart } from '@usequeek/theme-kit/hooks/use-cart';
import { useProducts } from '@usequeek/theme-kit/hooks/use-products';
import { useStorefront } from '@usequeek/theme-kit/provider';
import { useHref } from '@usequeek/theme-kit/hooks/use-href';
import { formatMoney, formatWireMoney } from '@usequeek/theme-kit/utils/format';
import { cartLinePricing } from '@usequeek/theme-kit/utils/cart-pricing';
import type { CartServerPricing } from '@usequeek/theme-kit/utils/cart-pricing';
import { useShopCart } from '@usequeek/theme-kit/hooks/use-shop-cart';
import { CartServerPricingProvider, useCartServerPricing } from '@usequeek/theme-kit/hooks/use-cart-server-pricing';
import { CartPanelController, type CartPanelControllerRenderProps } from '@usequeek/theme-kit/components/cart/cart-panel-controller';
import { Image } from '@usequeek/theme-kit/components/image';
import { LanguageSwitcher } from '@usequeek/theme-kit/components/language-switcher';
import { useLocales } from '@usequeek/theme-kit/hooks/use-locales';
import type { StoreLocale } from '@usequeek/theme-kit/utils/locale-switch';
import { ThemeMount } from '@usequeek/theme-kit/theme-mount';

export function Header({ menu, showCart }: HeaderProps): JSX.Element {
  const { vendor } = useStorefront();
  const { items } = useCart();
  const href = useHref();

  return (
    <header>
      <a href={href('/')}>{vendor?.name}</a>
      {menu.map((item) => <a key={item.label} href={item.ref ?? '#'}>{item.label}</a>)}
      {showCart ? <span>{items.length}</span> : null}
      <LanguageSwitcher className="header-language" />
    </header>
  );
}

export function Footer({ copyright }: FooterProps): JSX.Element {
  const { hasMultiple, locales, hrefFor } = useLocales();
  const label = (l: StoreLocale): string => l.native_name;

  return (
    <footer>
      {copyright}
      <LanguageSwitcher variant="inline-list" showCode />
      <LanguageSwitcher variant="menu" side="top" align="start" showCode />
      <LanguageSwitcher variant="menu">
        {({ active, displayName, open, setOpen }) => (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
            {displayName(active)}
          </button>
        )}
      </LanguageSwitcher>
      {hasMultiple ? locales.map((l) => <a key={l.locale} href={hrefFor(l)}>{label(l)}</a>) : null}
    </footer>
  );
}

/** A cart drawer that prints what the server charges, through the kit only. */
export function CartDrawer(): JSX.Element {
  return (
    <CartPanelController>
      {({ isOpen, items, total, pricing, currency }) => {
        const charged: CartServerPricing | null | undefined = pricing;

        return isOpen ? (
          <ul>
            {items.map((item) => {
              const line = cartLinePricing(charged, item.id);

              return (
                <li key={item.id}>
                  {line?.list_line_total ? <del>{formatWireMoney(line.list_line_total, currency)}</del> : null}
                  {line ? formatWireMoney(line.line_total, currency) : formatMoney(item.unit_price * item.quantity, currency)}
                </li>
              );
            })}
            <li>{charged ? formatWireMoney(charged.total, currency) : formatMoney(total, currency)}</li>
          </ul>
        ) : <></>;
      }}
    </CartPanelController>
  );
}

/** Props built by hand, the way a theme's own test or story does, before `pricing` existed: must still type. */
export const HAND_BUILT_PANEL_PROPS: CartPanelControllerRenderProps = {
  isOpen: false,
  items: [],
  total: 0,
  currency: 'NGN',
  onClose: () => {},
  onCheckout: () => {},
  onViewCart: () => {},
  onBrowseCollections: () => {},
  onSetQuantity: () => {},
  onRemove: () => {},
};

export function CartCount({ shopId }: { shopId: string }): JSX.Element {
  const { count, pricing } = useShopCart(shopId);
  const provided = useCartServerPricing();

  return <span>{count}{pricing ? pricing.total : provided?.total ?? ''}</span>;
}

/** What a host app does: one provider above every theme. */
export function HostSeam({ pricing, children }: { pricing: CartServerPricing | null; children: JSX.Element }): JSX.Element {
  return <CartServerPricingProvider value={pricing}>{children}</CartServerPricingProvider>;
}

export function ProductCard({ product }: { product: Product }): JSX.Element {
  const { addProduct } = useCart();

  return (
    <article>
      <Image src={product.media.thumbnail ?? ''} alt={product.title} />
      <h3>{product.title}</h3>
      <span>{formatMoney(product.pricing.sale_amount, product.currency)}</span>
      <button type="button" onClick={() => addProduct(product, 1)}>Add to cart</button>
    </article>
  );
}

export function Grid(): JSX.Element {
  const { products, isLoading } = useProducts();
  if (isLoading) return <p>Loading…</p>;

  return <div>{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>;
}

export const theme: Pick<ThemeModule, 'Header' | 'Footer'> = { Header, Footer };

/**
 * Mounting the theme — the thing an external developer could not do before
 * ThemeMount existed, because the component that does it lived in the
 * storefront app rather than the package.
 */
export function Preview({ theme: mod, children }: { theme: ThemeModule; children: JSX.Element }): JSX.Element {
  return (
    <ThemeMount
      theme={mod}
      headerProps={{ announcement: null, logo: null, menu: [], showSearch: true, showCart: true, showAccount: true, showOffers: true }}
      footerProps={{ copyright: '© Demo Store' }}
    >
      {children}
    </ThemeMount>
  );
}
