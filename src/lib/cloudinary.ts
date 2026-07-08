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
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloud || !preset) {
        throw new Error("Photo uploads aren't configured yet. You can skip this.");
    }
    if (!file.type.startsWith("image/")) {
        throw new Error("Please choose an image file.");
    }
    if (file.size > MAX_AVATAR_BYTES) {
        throw new Error("Image is too large (max 5 MB).");
    }

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", preset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
        method: "POST",
        body: form,
    });

    if (!res.ok) {
        throw new Error("Upload failed. Please try again.");
    }
    const data = await res.json();
    return { url: data.secure_url as string, publicId: data.public_id as string };
}
