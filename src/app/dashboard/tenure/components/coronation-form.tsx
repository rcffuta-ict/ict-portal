"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Check,
    Crown,
    ImagePlus,
    Loader2,
    Palette as PaletteIcon,
    Trash2,
    Upload,
    X,
    AlertTriangle,
} from "lucide-react";
import type { Tenure } from "@/lib/types/portal";
import { coronationSchema, type CoronationInput } from "@/lib/coronation";
import { BRAND_PALETTE, checkPalette, isHexColour, parsePalette } from "@/lib/palette";
import { isCloudinaryConfigured, uploadThemeImage } from "@/lib/cloudinary";
import { DEFAULT_TENURE_BANNER } from "@/config/tenure-branding";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import { clearCoronationAction, coronateTenureAction } from "../actions";

/**
 * Record what the coronation retreat unveiled: the theme, the Bible reference it is
 * drawn from, the day, and — optionally — the banner, icon and colours the portal wears
 * for the rest of the session.
 *
 * Everything shown here as you type (the reference format, the contrast ratios) is
 * checked again by coronateTenureAction; this form only saves you a round trip.
 */
export function CoronationForm({
    tenure,
    onClose,
    onSaved,
}: {
    tenure: Tenure;
    onClose: () => void;
    onSaved: () => void;
}) {
    const router = useRouter();
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();
    const stored = parsePalette(tenure.theme_palette);

    const {
        register,
        handleSubmit,
        setValue,
        setError,
        control,
        formState: { errors, isSubmitting },
    } = useForm<CoronationInput>({
        resolver: zodResolver(coronationSchema),
        mode: "onTouched",
        defaultValues: {
            theme: tenure.theme ?? "",
            themeText: tenure.theme_text ?? "",
            // Empty, never today or the start date: the retreat is its own day.
            coronatedOn: tenure.coronated_on ?? "",
            bannerUrl: tenure.theme_banner_url ?? "",
            iconUrl: tenure.theme_icon_url ?? "",
            usePalette: !!stored,
            primary: stored?.primary ?? BRAND_PALETTE.primary,
            accent: stored?.accent ?? BRAND_PALETTE.accent,
        },
    });

    const [bannerUrl, iconUrl, usePalette, primary, accent, theme] = useWatch({
        control,
        name: ["bannerUrl", "iconUrl", "usePalette", "primary", "accent", "theme"],
    });

    // Close on Escape; keep the page behind from scrolling.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, []);

    const onSubmit = async (values: CoronationInput) => {
        const res = await coronateTenureAction(tenure.id, values);
        if (!res.success) {
            // Put the server's objection on the field it is about, where it can be fixed.
            const fieldErrors = "fieldErrors" in res ? res.fieldErrors : undefined;
            if (fieldErrors && Object.keys(fieldErrors).length) {
                for (const [field, message] of Object.entries(fieldErrors)) {
                    setError(field as keyof CoronationInput, { message });
                }
            } else {
                showAlert({ type: "error", title: "Couldn't save", message: res.error });
            }
            return;
        }
        onSaved();
        // The palette is applied by the server layout; refresh so it repaints now.
        router.refresh();
        onClose();
    };

    const confirmRemove = () =>
        showAlert({
            type: "warning",
            title: "Remove this coronation?",
            message:
                "The theme, its reference, the date, the banner, icon and colours are all cleared, and the portal goes back to the brand colours. Use this only if it was recorded by mistake.",
            confirmText: "Remove",
            onConfirm: async () => {
                const res = await clearCoronationAction(tenure.id);
                if (!res.success) {
                    showAlert({ type: "error", title: "Couldn't remove", message: res.error });
                    return;
                }
                onSaved();
                router.refresh();
                onClose();
            },
        });

    const palette = parsePalette({ primary, accent }) ?? BRAND_PALETTE;
    const contrast = checkPalette(palette);

    return (
        <>
            {/* Outside the backdrop: a click inside the alert must not bubble up and close
            the form behind it. */}
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-4"
                onClick={onClose}
            >
                <form
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="coronation-title"
                    noValidate
                    onClick={(e) => e.stopPropagation()}
                    onSubmit={handleSubmit(onSubmit)}
                    className="flex h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl"
                >
                    <header className="safe-top flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
                        <div className="min-w-0">
                            <h2 id="coronation-title" className="flex items-center gap-2 font-bold text-slate-900">
                                <Crown className="h-4 w-4 text-rcf-navy" aria-hidden="true" />
                                {tenure.theme ? "Edit coronation" : "Record coronation"}
                            </h2>
                            <p className="text-xs text-slate-500">{tenure.session} session</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="-m-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </header>

                    <div className="flex-1 space-y-8 overflow-y-auto px-4 py-5 sm:px-6">
                        {/* --- 1. What was unveiled ---------------------------------- */}
                        <fieldset className="space-y-4">
                            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                            The theme
                            </legend>
                            <Field id="c-theme" label="Theme" error={errors.theme?.message} required>
                                <input
                                    id="c-theme"
                                    autoComplete="off"
                                    placeholder="e.g. Arise and Shine"
                                    {...register("theme")}
                                    {...aria("c-theme", errors.theme?.message)}
                                    className={inputClass(!!errors.theme)}
                                />
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field
                                    id="c-text"
                                    label="Theme text"
                                    hint="The Bible reference, e.g. John 1:1-3"
                                    error={errors.themeText?.message}
                                    required
                                >
                                    <input
                                        id="c-text"
                                        autoComplete="off"
                                        placeholder="Isaiah 60:1-3"
                                        {...register("themeText")}
                                        {...aria("c-text", errors.themeText?.message, "c-text-hint")}
                                        className={inputClass(!!errors.themeText)}
                                    />
                                </Field>
                                <Field
                                    id="c-date"
                                    label="Coronation date"
                                    hint="The day of the retreat — not the session's start"
                                    error={errors.coronatedOn?.message}
                                    required
                                >
                                    <input
                                        id="c-date"
                                        type="date"
                                        {...register("coronatedOn")}
                                        {...aria("c-date", errors.coronatedOn?.message, "c-date-hint")}
                                        className={inputClass(!!errors.coronatedOn)}
                                    />
                                </Field>
                            </div>
                        </fieldset>

                        {/* --- 2. Banner and icon ------------------------------------ */}
                        <fieldset className="space-y-4">
                            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                            Banner and icon <span className="font-medium normal-case">(optional)</span>
                            </legend>
                            {!isCloudinaryConfigured() && (
                                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                Image uploads aren&rsquo;t configured on this portal, so the generic
                                banner will be used. Everything else can still be saved.
                                </p>
                            )}
                            <ImagePicker
                                label="Banner"
                                hint="Wide, about 1600×600. The middle is what shows on a phone."
                                value={bannerUrl || ""}
                                fallback={DEFAULT_TENURE_BANNER}
                                shape="banner"
                                error={errors.bannerUrl?.message}
                                onChange={(url) => setValue("bannerUrl", url, { shouldValidate: true, shouldDirty: true })}
                            />
                            <ImagePicker
                                label="Icon"
                                hint="Square, at least 256×256."
                                value={iconUrl || ""}
                                shape="icon"
                                error={errors.iconUrl?.message}
                                onChange={(url) => setValue("iconUrl", url, { shouldValidate: true, shouldDirty: true })}
                            />
                        </fieldset>

                        {/* --- 3. Colours -------------------------------------------- */}
                        <fieldset className="space-y-4">
                            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                            Colours <span className="font-medium normal-case">(optional)</span>
                            </legend>
                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                                <input
                                    type="checkbox"
                                    {...register("usePalette")}
                                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 accent-rcf-navy"
                                />
                                <span className="text-sm">
                                    <span className="font-semibold text-slate-800">
                                    Dress the dashboard in the session&rsquo;s colours
                                    </span>
                                    <span className="block text-xs text-slate-500">
                                    Off keeps the RCF navy and gold. Public event pages always keep
                                    the brand.
                                    </span>
                                </span>
                            </label>

                            {usePalette && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <ColourField
                                            id="c-primary"
                                            label="Main colour"
                                            value={primary}
                                            error={errors.primary?.message}
                                            onChange={(v) => setValue("primary", v, { shouldValidate: true, shouldDirty: true })}
                                        />
                                        <ColourField
                                            id="c-accent"
                                            label="Accent"
                                            value={accent}
                                            error={errors.accent?.message}
                                            onChange={(v) => setValue("accent", v, { shouldValidate: true, shouldDirty: true })}
                                        />
                                    </div>

                                    <PalettePreview palette={palette} theme={theme || tenure.session} />

                                    <ul className="space-y-1.5" aria-label="Readability checks">
                                        {contrast.checks.map((c) => (
                                            <li
                                                key={c.pair}
                                                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs ${
                                                    c.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                                                }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {c.ok ? (
                                                        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                    ) : (
                                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                    )}
                                                    {c.pair}
                                                </span>
                                                <span className="shrink-0 font-mono font-bold">
                                                    {c.ratio}:1 <span className="font-normal opacity-70">/ {c.needed}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setValue("primary", BRAND_PALETTE.primary, { shouldValidate: true });
                                            setValue("accent", BRAND_PALETTE.accent, { shouldValidate: true });
                                        }}
                                        className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-rcf-navy hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                    >
                                    Reset to the brand colours
                                    </button>
                                </div>
                            )}
                        </fieldset>

                        {tenure.theme && (
                            <div className="border-t border-slate-100 pt-5">
                                <button
                                    type="button"
                                    onClick={confirmRemove}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                                >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Remove coronation (recorded by mistake)
                                </button>
                            </div>
                        )}
                    </div>

                    <footer className="safe-bottom flex shrink-0 gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:justify-end sm:px-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy sm:flex-none"
                        >
                        Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-rcf-navy px-6 text-sm font-bold text-white hover:bg-rcf-navy-light focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy focus-visible:ring-offset-2 disabled:opacity-60 sm:flex-none"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                            ) : (
                                <Crown className="h-4 w-4" aria-hidden="true" />
                            )}
                            {isSubmitting ? "Saving…" : "Save coronation"}
                        </button>
                    </footer>
                </form>
            </div>
        </>
    );
}

// ---------------------------------------------------------------------------

function inputClass(invalid: boolean) {
    return `h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition-colors focus:ring-2 ${
        invalid
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
            : "border-slate-300 focus:border-rcf-navy focus:ring-rcf-navy/15"
    }`;
}

function aria(id: string, error?: string, hintId?: string) {
    const describedBy = [error ? `${id}-error` : null, hintId ?? null].filter(Boolean).join(" ");
    return { "aria-invalid": !!error, "aria-describedby": describedBy || undefined };
}

function Field({
    id,
    label,
    hint,
    error,
    required,
    children,
}: {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1">
            <label htmlFor={id} className="text-sm font-semibold text-slate-700">
                {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
            </label>
            {children}
            {error ? (
                <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-600">
                    {error}
                </p>
            ) : hint ? (
                <p id={`${id}-hint`} className="text-xs text-slate-500">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

function ColourField({
    id,
    label,
    value,
    error,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    error?: string;
    onChange: (v: string) => void;
}) {
    // The text box may hold a half-typed hex; only a complete one is passed up.
    const [text, setText] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setText(value), 0);
        return () => clearTimeout(t);
    }, [value]);

    return (
        <div className="space-y-1">
            <label htmlFor={id} className="text-sm font-semibold text-slate-700">
                {label}
            </label>
            <div className={`flex h-11 items-center gap-2 rounded-xl border bg-white pl-1.5 pr-3 ${error ? "border-red-400" : "border-slate-300"}`}>
                <input
                    type="color"
                    aria-label={`${label} picker`}
                    value={isHexColour(value) ? value : "#000000"}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                />
                <input
                    id={id}
                    value={text}
                    maxLength={7}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => {
                        const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                        setText(v);
                        if (isHexColour(v)) onChange(v.toLowerCase());
                    }}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase outline-none"
                />
            </div>
            {error && (
                <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}

/**
 * A miniature of what the dashboard will look like: the sidebar strip, a button, its
 * hover state and an accent — painted with inline colours, so it previews the palette
 * without repainting the real page underneath the dialog.
 */
function PalettePreview({ palette, theme }: { palette: { primary: string; primaryLight: string; accent: string }; theme: string }) {
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200" aria-label="Preview">
            <div className="flex">
                <div className="w-24 shrink-0 space-y-2 p-3 sm:w-32" style={{ backgroundColor: palette.primary }}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-white">
                        <PaletteIcon className="h-3 w-3" style={{ color: palette.accent }} aria-hidden="true" />
                        Portal
                    </div>
                    <div className="h-1.5 w-14 rounded-full bg-white/80" />
                    <div className="h-1.5 w-10 rounded-full bg-white/50" />
                    <div className="rounded px-1.5 py-1 text-[9px] font-semibold text-white" style={{ backgroundColor: palette.primaryLight }}>
                        Hover
                    </div>
                </div>
                <div className="flex-1 space-y-2 bg-slate-50 p-3">
                    <p className="truncate font-serif text-sm font-bold" style={{ color: palette.primary }}>
                        {theme}
                    </p>
                    <div className="h-1.5 w-3/4 rounded-full bg-slate-200" />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="rounded-md px-2.5 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: palette.primary }}>
                            Button
                        </span>
                        <span className="rounded-md px-2.5 py-1 text-[10px] font-bold" style={{ backgroundColor: palette.accent, color: palette.primary }}>
                            Accent
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ImagePicker({
    label,
    hint,
    value,
    fallback,
    shape,
    error,
    onChange,
}: {
    label: string;
    hint: string;
    value: string;
    fallback?: string;
    shape: "banner" | "icon";
    error?: string;
    onChange: (url: string) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const enabled = isCloudinaryConfigured();
    const shown = value || fallback;

    const pick = async (file: File | undefined) => {
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        try {
            const { url } = await uploadThemeImage(file);
            onChange(url);
        } catch (e) {
            setUploadError(e instanceof Error ? e.message : "Upload failed. Please try again.");
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const message = uploadError || error;

    return (
        <div className={shape === "icon" ? "flex items-center gap-4" : "space-y-2"}>
            <div
                className={`relative shrink-0 overflow-hidden bg-slate-100 ${
                    shape === "banner" ? "aspect-[8/3] w-full rounded-xl" : "h-20 w-20 rounded-2xl"
                }`}
            >
                {shown ? (
                    <Image
                        src={shown}
                        alt=""
                        fill
                        sizes={shape === "banner" ? "(max-width: 672px) 100vw, 672px" : "80px"}
                        className="object-cover"
                        unoptimized={shown.endsWith(".svg")}
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                        <ImagePlus className="h-6 w-6" aria-hidden="true" />
                    </div>
                )}
                {!value && fallback && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Generic banner
                    </span>
                )}
                {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70" role="status">
                        <Loader2 className="h-5 w-5 animate-spin text-rcf-navy motion-reduce:animate-none" aria-hidden="true" />
                        <span className="sr-only">Uploading…</span>
                    </div>
                )}
            </div>

            <div className="min-w-0 space-y-1.5">
                <p className="text-sm font-semibold text-slate-700">{label}</p>
                <p className="text-xs text-slate-500">{hint}</p>
                <div className="flex flex-wrap gap-2">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        tabIndex={-1}
                        onChange={(e) => pick(e.target.files?.[0])}
                        disabled={!enabled || uploading}
                    />
                    <button
                        type="button"
                        disabled={!enabled || uploading}
                        onClick={() => inputRef.current?.click()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-50"
                    >
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        {value ? "Replace" : "Upload"}
                    </button>
                    {value && (
                        <button
                            type="button"
                            onClick={() => onChange("")}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                        </button>
                    )}
                </div>
                {message && (
                    <p role="alert" className="text-xs font-medium text-red-600">
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}
