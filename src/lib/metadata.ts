/**
 * Page-title helpers.
 *
 * Every page reads "<Page> | ICT Portal, RCFFUTA". The suffix is set once as a
 * `title.template` in the root layout, and a leaf page only supplies its own name.
 *
 * THE GOTCHA THIS FILE EXISTS FOR
 *   In the App Router, `title.template` applies to a segment's DESCENDANTS, never to
 *   the segment that declares it. So an intermediate layout that sets a plain string
 *   title (`title: "Tenure Manager"`) consumes the parent's template for itself and
 *   leaves its own children with none — which is how a nested page ends up rendering a
 *   bare "Handing Over" with no suffix.
 *
 *   Any layout that has child pages must therefore re-declare the template. That is
 *   what {@link sectionTitle} does, and why the section's own title spells the suffix
 *   out: a template can't apply to itself.
 *
 * Plain data — safe to import anywhere.
 */

/** The suffix every page title carries. */
export const SITE_SUFFIX = "ICT Portal, RCFFUTA";

/** The root template. `%s` is the page's own title. */
export const TITLE_TEMPLATE = `%s | ${SITE_SUFFIX}`;

/**
 * Title config for a LAYOUT that has child pages.
 *
 * Gives the section its own title and keeps the template alive for everything nested
 * beneath it.
 *
 *   sectionTitle("Tenure Manager")
 *     /dashboard/tenure           -> "Tenure Manager | ICT Portal, RCFFUTA"
 *     /dashboard/tenure/handover  -> "Handing Over | ICT Portal, RCFFUTA"
 *
 * `default` is the BARE name, not the suffixed one: the ROOT template still applies to
 * a section's own default, so spelling the suffix out here produced
 * "Events | ICT Portal, RCFFUTA | ICT Portal, RCFFUTA". The `template` below is for
 * descendants only — it never applies to this segment.
 */
export function sectionTitle(name: string) {
    return {
        default: name,
        template: TITLE_TEMPLATE,
    };
}
