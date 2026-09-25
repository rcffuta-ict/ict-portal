/**
 * The banner the Tenure page wears when a session has no banner of its own — before
 * coronation, or when a coronation was recorded without one.
 *
 * To use your own: put the image in `public/images/` and point this at it (for example
 * "/images/tenure-banner-default.jpg").
 *
 * Size: 2400×800 (3:1), JPG or WebP, ideally under 500 KB. The hero shows it WHOLE at
 * 3:1 on every screen — nothing is cropped or laid over it — and a blurred copy of it
 * tints the hero around it. A banner of another shape is cropped to 3:1, so make it 3:1.
 * On a phone it is only ~115 px tall: fine detail is lost, bold lettering survives.
 */
export const DEFAULT_TENURE_BANNER = "/images/tenure-banner-default.jpeg";
