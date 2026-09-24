/**
 * Client-side Cloudinary upload (unsigned). Profile pictures are OPTIONAL, so this
 * is only ever called when a user actively picks a file.
 *
 * Requires an *unsigned* upload preset configured in the Cloudinary dashboard, plus:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
 *
 * Uploading straight from the browser keeps image bytes off our server (better on a
 * slow mobile connection) and needs no extra dependency — just `fetch`.
 */

export interface UploadedImage {
    url: string;
    publicId: string;
}

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export function isCloudinaryConfigured(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
            process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
    );
}

export async function uploadAvatar(file: File): Promise<UploadedImage> {
    return uploadImage(file, MAX_AVATAR_BYTES, "Photo uploads aren't configured yet. You can skip this.");
}

/** Banners are shown full-width, so they may be larger than an avatar. */
export const MAX_THEME_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

const THEME_NOT_CONFIGURED = "Image uploads aren't configured on this portal yet.";

/** A coronation banner or icon. Same unsigned preset as avatars. */
export async function uploadThemeImage(file: File): Promise<UploadedImage> {
    return uploadImage(file, MAX_THEME_IMAGE_BYTES, THEME_NOT_CONFIGURED);
}

/**
 * Is this an image in this project's own Cloudinary cloud? Anything saved as a banner,
 * icon or avatar must be: the upload is unsigned and happens in the browser, so without
 * this check anyone who reached the action could make every dashboard load an image
 * from a server of their choosing. It is also all `next/image` is configured to load.
 */
export function isOwnCloudinaryUrl(url: string): boolean {
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloud) return false;
    try {
        const u = new URL(url);
        return (
            u.protocol === "https:" &&
            u.hostname === "res.cloudinary.com" &&
            u.pathname.startsWith(`/${cloud}/`)
        );
    } catch {
        return false;
    }
}

/**
 * A banner or icon from a pasted link, IMPORTED rather than hot-linked: Cloudinary
 * fetches the image itself and stores a copy, so what is saved is still our own URL.
 * That keeps the own-cloud rule above, keeps next/image optimising it for phones, and
 * means the banner survives the source site deleting or changing the image. It also
 * spares a phone on mobile data from uploading the file — only the link is sent.
 */
export async function importThemeImageFromUrl(link: string): Promise<UploadedImage> {
    let url: URL;
    try {
        url = new URL(link.trim());
    } catch {
        throw new Error("That isn't a link — paste the full address, starting with https://");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("Paste a web link, starting with https://");
    }
    // Already one of ours: nothing to copy.
    if (isOwnCloudinaryUrl(url.href)) return { url: url.href, publicId: "" };

    return postToCloudinary(url.href, THEME_NOT_CONFIGURED);
}

async function uploadImage(file: File, maxBytes: number, notConfigured: string): Promise<UploadedImage> {
    if (!isCloudinaryConfigured()) {
        throw new Error(notConfigured);
    }
    if (!file.type.startsWith("image/")) {
        throw new Error("Please choose an image file.");
    }
    if (file.size > maxBytes) {
        throw new Error(`Image is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`);
    }

    return postToCloudinary(file, notConfigured);
}

/** `file` is the image itself, or a URL for Cloudinary to fetch. */
async function postToCloudinary(file: File | string, notConfigured: string): Promise<UploadedImage> {
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloud || !preset) throw new Error(notConfigured);

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", preset);

    let res: Response;
    try {
        res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
            method: "POST",
            body: form,
        });
    } catch {
        throw new Error("Couldn't reach the image service. Check your connection and try again.");
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.secure_url) {
        // Cloudinary says why (a preset that isn't unsigned, a link that isn't an
        // image, a format the preset refuses) — pass that on rather than a shrug.
        const reason: string | undefined = data?.error?.message;
        throw new Error(
            typeof file === "string"
                ? `Couldn't import that link${reason ? `: ${reason}` : ". Make sure it opens an image directly."}`
                : `Upload failed${reason ? `: ${reason}` : ". Please try again."}`,
        );
    }
    return { url: data.secure_url as string, publicId: data.public_id as string };
}

/**
 * `next/image` loader for Cloudinary images: the browser asks Cloudinary's CDN for the
 * size it needs, instead of our server fetching the original and resizing it.
 *
 * Not only faster. The built-in optimizer gives up on an upstream fetch after 7 seconds,
 * and an image uploaded a moment ago is not in Cloudinary's CDN cache yet, so on a slow
 * connection the first request failed and showed a broken image until it was reloaded
 * by hand. Cloudinary serving its own images has no such timeout and no second hop.
 *
 * `c_limit` never upscales; `f_auto` sends WebP/AVIF to browsers that take them;
 * `q_auto` lets Cloudinary pick the quality unless the caller asked for one.
 */
export function cloudinaryLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
    const marker = "/image/upload/";
    const at = src.indexOf(marker);
    if (at === -1) return src;
    const head = src.slice(0, at + marker.length);
    const rest = src.slice(at + marker.length);
    return `${head}f_auto,q_${quality ?? "auto"},c_limit,w_${width}/${rest}`;
}

/** The loader for `src`, or undefined to leave it to the built-in optimizer. */
export function imageLoaderFor(src: string | null | undefined) {
    if (!src) return undefined;
    try {
        return new URL(src).hostname === "res.cloudinary.com" ? cloudinaryLoader : undefined;
    } catch {
        // A relative path such as the bundled default banner.
        return undefined;
    }
}
