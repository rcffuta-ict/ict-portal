import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Hand } from "lucide-react";
import { getTestimonyById } from "../actions";
import { ShareButton } from "@/components/lo-app/testimonies/ShareButton";
import { LoLogo } from "@/components/lo-app/LoLogo";
import { categoryLabel, testimonyExcerpt } from "@/lib/testimonies";
import { formatEventDate, parseEventDate } from "@/lib/event-utils";

interface PageProps {
    params: Promise<{ id: string }>;
}

/** Cached per request so the metadata pass and the render share one DB round trip. */
const loadTestimony = cache(async (id: string) => getTestimonyById(id));

/**
 * The shareable page for one testimony.
 *
 * This is a server component on purpose: a link pasted into WhatsApp is fetched by
 * a crawler that runs no JavaScript, so the title and excerpt have to be in the HTML
 * for the preview card to render. Only approved testimonies are public — the action
 * enforces that, so an unapproved id 404s for everyone but its author and moderators.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const result = await loadTestimony(id);

    if (!result.success || !result.data) {
        return { title: "Testimony | Lo! App" };
    }

    const testimony = result.data;
    const description = testimonyExcerpt(testimony.body, 200);
    const title = `${testimony.title} | Testimony`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: "article",
            siteName: "RCF FUTA Portal",
            url: `https://ict.rcffuta.com/lo-app/testimonies/${id}`,
            images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630, alt: title }],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: ["/opengraph-image.jpg"],
        },
    };
}

export default async function TestimonyPage({ params }: PageProps) {
    const { id } = await params;
    const result = await loadTestimony(id);

    if (!result.success || !result.data) {
        notFound();
    }

    const testimony = result.data;
    const date = parseEventDate(testimony.publishedAt || testimony.createdAt);

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-rcf-navy pt-safe">
                <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5">
                    <Link
                        href="/lo-app"
                        className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Lo! feed
                    </Link>
                    <LoLogo size="md" variant="dark" mode="short" />
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-4 py-6">
                <article className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-rcf-gold/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            {categoryLabel(testimony.category)}
                        </span>
                        {testimony.status !== "approved" && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                Not published yet — only you can see this
                            </span>
                        )}
                    </div>

                    <h1 className="mt-3 text-2xl leading-tight font-bold text-balance text-slate-900 sm:text-3xl">
                        {testimony.title}
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        {testimony.authorName} · {formatEventDate(date)}
                    </p>

                    <div className="mt-5 text-base leading-relaxed whitespace-pre-wrap text-slate-700">
                        {testimony.body}
                    </div>

                    {testimony.scriptureReference && (
                        <p className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                            <BookOpen className="h-4 w-4 text-slate-400" />
                            {testimony.scriptureReference}
                        </p>
                    )}

                    <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-5">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                            <Hand className="h-4 w-4 text-rcf-gold" />
                            {testimony.amenCount} Amen
                            {testimony.amenCount === 1 ? "" : "s"}
                        </span>

                        {testimony.status === "approved" && (
                            <ShareButton
                                testimonyId={testimony.id}
                                title={testimony.title}
                                body={testimony.body}
                                shareCount={testimony.shareCount}
                                variant="solid"
                            />
                        )}
                    </div>
                </article>

                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 text-center">
                    <p className="text-sm font-semibold text-slate-900">
                        Has God done something for you too?
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                        Members of RCF FUTA can share their testimony on Lo!
                    </p>
                    <Link
                        href="/lo-app"
                        className="mt-4 inline-flex items-center justify-center rounded-2xl bg-rcf-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light"
                    >
                        Open Lo! App
                    </Link>
                </div>
            </main>
        </div>
    );
}
