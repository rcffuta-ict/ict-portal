import { paletteCss, type Palette } from "@/lib/palette";

/**
 * Repaint the app in a session's palette by overriding the brand tokens on `:root`.
 *
 * A server component, so the colours are in the first paint — no flash of navy on a
 * slow connection before the session's colours arrive. Renders nothing when there is no
 * valid palette, which leaves the `@theme` brand defaults standing.
 *
 * `paletteCss` emits only `#rrggbb` values it has re-validated itself, which is what
 * makes writing it into a <style> element safe.
 *
 * To extend the palette to another area (public events, Lo!), render this in that
 * area's layout — nothing else changes.
 */
export function ThemeStyle({ palette }: { palette: Palette | null }) {
    const css = paletteCss(palette);
    if (!css) return null;
    return <style id="session-palette" dangerouslySetInnerHTML={{ __html: css }} />;
}
