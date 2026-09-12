/**
 * Framework-owned blocks. Themes do NOT implement these — the React logic
 * lives here, themes only style them via `.core-block-*` scoped selectors
 * in their theme.css.
 */

export { CoreDividerBlock } from './divider';
export { CoreCalloutBlock } from './callout';
export { CoreQuoteBlock } from './quote';
export { CoreEmbedBlock } from './embed';
export { CoreVideoBlock } from './video';
export { CoreTableBlock } from './table';
export { CoreButtonBlock } from './button';
export { CoreImageBlock } from './image';
export { CoreContentDefaultBlock } from './content-default';
export { CoreReviewsBlock } from './reviews';
export { CoreFaqBlock } from './faq';
export { CoreProductQaBlock } from './product-qa';

export {
  FRAMEWORK_BLOCK_MANIFEST,
  FRAMEWORK_OWNED_TYPES,
  CONTENT_DEFAULT_IS_FRAMEWORK_OWNED,
} from './manifest';
