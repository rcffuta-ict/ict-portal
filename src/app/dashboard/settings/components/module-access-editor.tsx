"use client";

import { useMemo, useState } from "react";
import { X, Plus, Check, Loader2, AlertCircle, ShieldCheck, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    MODULES,
    CATEGORY_TOKENS,
    MODULE_META,
    type ModuleId,
    type ModuleAccessConfig,
    type WriteScope,
} from "@/lib/modules";
import { updateModuleAccessAction, type PositionOption } from "../actions";

interface Props {
    config: ModuleAccessConfig;
    positions: PositionOption[];
}

interface RowState {
    readTokens: string[];
    writeTokens: string[];
    writeScope: WriteScope;
    saving: boolean;
    error: string | null;
    saved: boolean;
}

const CATEGORY_SET = new Set<string>(CATEGORY_TOKENS);

export function ModuleAccessEditor({ config, positions }: Props) {
    const slugMap = useMemo(() => {
        const map = new Map<string, PositionOption>();
        for (const p of positions) map.set(p.slug, p);
        return map;
    }, [positions]);

    // Distinct slug suggestions (active positions first for relevance).
    const slugSuggestions = useMemo(
        () => positions.filter((p) => p.isActive).map((p) => p.slug),
        [positions],
    );

    const [rows, setRows] = useState<Record<ModuleId, RowState>>(() => {
        const initial = {} as Record<ModuleId, RowState>;
        for (const m of MODULES) {
            initial[m] = {
                readTokens: [...config[m].readSlugs],
                writeTokens: [...config[m].writeSlugs],
                writeScope: config[m].writeScope,
                saving: false,
                error: null,
                saved: false,
            };
        }
        return initial;
    });

    function patch(module: ModuleId, next: Partial<RowState>) {
        setRows((prev) => ({
            ...prev,
            // any content edit clears a prior "saved" flag
            [module]: { ...prev[module], saved: false, error: null, ...next },
        }));
    }

    function isDirty(module: ModuleId): boolean {
        const r = rows[module];
        const c = config[module];
        return (
            r.writeScope !== c.writeScope ||
            r.readTokens.join("|") !== c.readSlugs.join("|") ||
            r.writeTokens.join("|") !== c.writeSlugs.join("|")
        );
    }

    async function save(module: ModuleId) {
        const r = rows[module];
        patch(module, { saving: true });
        const res = await updateModuleAccessAction({
            module,
            readTokens: r.readTokens,
            writeTokens: r.writeTokens,
            writeScope: r.writeScope,
        });
        if (res.success) {
            // Reflect the new baseline so the row is no longer "dirty".
            config[module].readSlugs = [...r.readTokens];
            config[module].writeSlugs = [...r.writeTokens];
            config[module].writeScope = r.writeScope;
            setRows((prev) => ({
                ...prev,
                [module]: { ...prev[module], saving: false, saved: true, error: null },
            }));
        } else {
            setRows((prev) => ({
                ...prev,
                [module]: { ...prev[module], saving: false, error: res.error ?? "Update failed" },
            }));
        }
    }

    return (
        <div className="space-y-5">
            {MODULES.map((module) => {
                const meta = MODULE_META[module];
                const row = rows[module];
                const dirty = isDirty(module);
                return (
                    <section
                        key={module}
                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-bold text-rcf-navy">{meta.label}</h2>
                                <p className="text-sm text-gray-500">{meta.description}</p>
                            </div>
                            {row.saved && !dirty && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                                    <Check className="h-4 w-4" /> Saved
                                </span>
                            )}
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <TokenField
                                label="Read access"
                                icon={<ShieldCheck className="h-4 w-4 text-blue-500" />}
                                tokens={row.readTokens}
                                onChange={(readTokens) => patch(module, { readTokens })}
                                suggestions={slugSuggestions}
                                slugMap={slugMap}
                                inputId={`${module}-read`}
                            />
                            <TokenField
                                label="Write access"
                                icon={<PencilLine className="h-4 w-4 text-amber-500" />}
                                tokens={row.writeTokens}
                                onChange={(writeTokens) => patch(module, { writeTokens })}
                                suggestions={slugSuggestions}
                                slugMap={slugMap}
                                inputId={`${module}-write`}
                            />
                        </div>

                        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                            <label className="flex flex-col gap-1 text-sm">
                                <span className="font-medium text-gray-700">Write scope</span>
                                <select
                                    value={row.writeScope}
                                    onChange={(e) =>
                                        patch(module, { writeScope: e.target.value as WriteScope })
                                    }
                                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-rcf-navy focus:outline-none focus:ring-1 focus:ring-rcf-navy"
                                >
                                    <option value="ALL">All — see everything in the module</option>
                                    <option value="OWN">Own — only the portion they oversee</option>
                                </select>
                            </label>

                            <div className="flex items-center gap-3">
                                {row.error && (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                                        <AlertCircle className="h-4 w-4" /> {row.error}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => save(module)}
                                    disabled={row.saving || !dirty}
                                    className="inline-flex items-center gap-2 rounded-md bg-rcf-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {row.saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {row.saving ? "Saving…" : "Save"}
                                </button>
                            </div>
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

interface TokenFieldProps {
    label: string;
    icon: React.ReactNode;
    tokens: string[];
    onChange: (tokens: string[]) => void;
    suggestions: string[];
    slugMap: Map<string, PositionOption>;
    inputId: string;
}

function TokenField({ label, icon, tokens, onChange, suggestions, slugMap, inputId }: TokenFieldProps) {
    const [draft, setDraft] = useState("");

    function add(raw: string) {
        const value = raw.trim();
        if (!value) return;
        // Normalise category tokens to uppercase; slugs stay as typed.
        const normalized = CATEGORY_SET.has(value.toUpperCase())
            ? value.toUpperCase()
            : value.toLowerCase();
        if (tokens.includes(normalized)) {
            setDraft("");
            return;
        }
        onChange([...tokens, normalized]);
        setDraft("");
    }

    function remove(token: string) {
        onChange(tokens.filter((t) => t !== token));
    }

    return (
        <div className="space-y-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                {icon}
                {label}
            </span>

            <div className="flex flex-wrap gap-1.5 rounded-md border border-gray-200 bg-gray-50 p-2 min-h-[2.75rem]">
                {tokens.length === 0 && (
                    <span className="px-1 text-xs text-gray-400">No one yet — admins still have access.</span>
                )}
                {tokens.map((token) => {
                    const isCategory = CATEGORY_SET.has(token);
                    const pos = slugMap.get(token);
                    const known = isCategory || !!pos;
                    const display = isCategory ? token : pos?.alias || pos?.title || token;
                    return (
                        <Badge
                            key={token}
                            variant={isCategory ? "purple" : known ? "info" : "warning"}
                            size="sm"
                            title={isCategory ? `All ${token} positions` : `${pos?.title ?? "Unknown position"} (${token})`}
                        >
                            <span>{display}</span>
                            <button
                                type="button"
                                onClick={() => remove(token)}
                                aria-label={`Remove ${display}`}
                                className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    );
                })}
            </div>

            <div className="flex gap-2">
                <input
                    id={inputId}
                    list={`${inputId}-options`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            add(draft);
                        }
                    }}
                    placeholder="Add a slug or category…"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-rcf-navy focus:outline-none focus:ring-1 focus:ring-rcf-navy"
                />
                <datalist id={`${inputId}-options`}>
                    {CATEGORY_TOKENS.map((c) => (
                        <option key={c} value={c}>
                            All {c} positions
                        </option>
                    ))}
                    {suggestions.map((slug) => {
                        const p = slugMap.get(slug);
                        return (
                            <option key={slug} value={slug}>
                                {p?.title ?? slug}
                            </option>
                        );
                    })}
                </datalist>
                <button
                    type="button"
                    onClick={() => add(draft)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    <Plus className="h-4 w-4" /> Add
                </button>
            </div>
        </div>
    );
}
