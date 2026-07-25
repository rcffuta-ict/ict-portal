"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, User, X } from "lucide-react";
import { uploadAvatar, isCloudinaryConfigured, type UploadedImage } from "@/lib/cloudinary";

/**
 * Optional profile-picture picker. Uploads straight to Cloudinary from the browser
 * and reports the resulting url + public id to the parent. Never required — always
 * shows a graceful fallback (initials) and can be skipped.
 */
export function AvatarUpload({
    currentUrl,
    initials,
    onUploaded,
    size = 96,
}: {
    currentUrl?: string | null;
    initials?: string;
    onUploaded: (img: UploadedImage | null) => void;
    size?: number;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const configured = isCloudinaryConfigured();

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError("");
        setUploading(true);
        try {
            const img = await uploadAvatar(file);
            setPreview(img.url);
            onUploaded(img);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed.");
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const clear = () => {
        setPreview(null);
        onUploaded(null);
    };

    return (
        <div className="flex items-center gap-4">
            <div
                className="relative rounded-full overflow-hidden bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0"
                style={{ width: size, height: size }}
            >
                {preview ? (
                    <Image src={preview} alt="Profile photo" fill sizes={`${size}px`} className="object-cover" />
                ) : initials ? (
                    <span style={{ fontSize: size / 3 }}>{initials}</span>
                ) : (
                    <User style={{ width: size / 2, height: size / 2 }} />
                )}
                {uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading || !configured}
                        className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <Camera className="h-4 w-4" />
                        {preview ? "Change photo" : "Add photo"}
                    </button>
                    {preview && (
                        <button
                            type="button"
                            onClick={clear}
                            className="inline-flex items-center gap-1 h-9 px-2 rounded-lg text-sm text-slate-400 hover:text-red-500"
                        >
                            <X className="h-4 w-4" /> Remove
                        </button>
                    )}
                </div>
                <p className="text-[11px] text-slate-400">
                    {configured ? "Optional · JPG or PNG, up to 5 MB." : "Photo uploads aren't set up — you can skip this."}
                </p>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>
        </div>
    );
}
