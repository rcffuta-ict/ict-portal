"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
    Check,
    Loader2,
    ArrowRight,
    ArrowLeft,
    ShieldAlert,
    PartyPopper,
    Mail,
    PencilLine,
} from "lucide-react";
import { findDepartment } from "@/lib/departments";
import { useDepartments } from "@/lib/hooks/useDepartments";
import { DepartmentSelect } from "@/components/academics/department-select";

import { Logo } from "@/components/ui/logo";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { computeLevel } from "@/lib/levels";
import { GENDER_OPTIONS } from "@/lib/gender";
import { PROFILE_PATH, parseLevelTokenInput, profilePath } from "@/lib/level-token";
import {
    validateInviteAction,
    submitRegistrationAction,
    lookupLevelMemberAction,
    getZonesAction,
    type RegistrationPayload,
} from "./action";
import { TokenEntry, type OpenedToken } from "./components/token-entry";

/** Who this member is, once an update-mode email lookup has matched. */
interface UpdateTarget {
    profileId: string;
    name: string;
    prefill: Record<string, string | null>;
}

type Reason = "register" | "update";

type InviteState =
    | { status: "loading" }
    | { status: "invalid"; reason: string }
    | {
          status: "ready";
          purpose: "create" | "update" | "reset" | "level";
          classSet: { entryYear: number | null; familyName: string | null; isFoundation: boolean } | null;
          targetName?: string;
          prefill: Record<string, string | null> | null;
          /** Outside production: the only email domain accepted (rcffuta.test). */
          testEmailDomain: string | null;
      };

type ValidateResult = Awaited<ReturnType<typeof validateInviteAction>> | OpenedToken;

function toInviteState(res: ValidateResult): InviteState {
    if (!res.valid) return { status: "invalid", reason: res.reason };
    return {
        status: "ready",
        purpose: res.purpose,
        classSet: res.classSet
            ? { entryYear: res.classSet.entryYear, familyName: res.classSet.familyName, isFoundation: res.classSet.isFoundation }
            : null,
        targetName: res.targetProfile ? `${res.targetProfile.firstName} ${res.targetProfile.lastName}` : undefined,
        prefill: res.prefill,
        testEmailDomain: res.testEmailDomain ?? null,
    };
}

/** Level tokens match in any case, so `RCF-7KX2P` and `rcf-7kx2p` are the same check. */
function tokenKey(token: string) {
    return parseLevelTokenInput(token) ?? token;
}

/**
 * /profile: a member's own record, created or updated with a level token.
 *
 * Arrive with a link (`?invite=…&reason=register|update`) and the form opens; arrive
 * without one and the page asks for the token. Either way the token and the choice end
 * up in the URL, so a refresh or a shared link lands in the same place.
 */
export default function ProfilePage() {
    return (
        <Suspense fallback={<CenteredLoader />}>
            <ProfileInner />
        </Suspense>
    );
}

function CenteredLoader() {
    return (
        <div className="flex justify-center py-20" role="status" aria-label="Loading">
            <Loader2 className="h-6 w-6 animate-spin text-rcf-navy motion-reduce:animate-none" />
        </div>
    );
}

function ProfileInner() {
    const params = useSearchParams();
    const router = useRouter();
    const token = params.get("invite")?.trim() || "";
    // `reason` decides what a LEVEL token is being used for right now: one token, two
    // links (see the Tokens tab in the Level module).
    const reason: Reason = (params.get("reason") || "").toLowerCase() === "update" ? "update" : "register";
    const [target, setTarget] = useState<UpdateTarget | null>(null);
    // The last check, keyed by the token it was for. A token typed on this page arrives
    // already checked, so the effect below doesn't ask the server twice.
    const [checked, setChecked] = useState<{ key: string; state: InviteState } | null>(null);
    const key = token ? tokenKey(token) : "";
    const invite: InviteState = checked && checked.key === key ? checked.state : { status: "loading" };

    useEffect(() => {
        if (!key || checked?.key === key) return;
        let active = true;
        (async () => {
            let state: InviteState;
            try {
                state = toInviteState(await validateInviteAction(key));
            } catch {
                state = { status: "invalid", reason: "Couldn't reach the server. Check your connection and reload." };
            }
            if (active) setChecked({ key, state });
        })();
        return () => {
            active = false;
        };
    }, [key, checked?.key]);

    /** Same token, the other job (register ⇄ update). */
    const switchTo = (next: Reason) => {
        setTarget(null);
        router.replace(profilePath(token, next), { scroll: true });
    };
    const enterAnotherToken = () => {
        setTarget(null);
        router.replace(PROFILE_PATH);
    };

    return (
        <div className="animate-fade-in max-w-3xl mx-auto w-full">
            <div className="flex justify-center md:hidden mb-2">
                <Logo width={80} asLink />
            </div>

            {!token ? (
                <TokenEntry
                    onOpened={(opened, why) => {
                        setChecked({ key: opened.token, state: toInviteState(opened) });
                        router.replace(profilePath(opened.token, why));
                    }}
                />
            ) : invite.status === "loading" ? (
                <CenteredLoader />
            ) : invite.status === "invalid" ? (
                <InviteBlocked reason={invite.reason} onRetry={enterAnotherToken} />
            ) : invite.purpose === "level" && reason === "update" && !target ? (
                <EmailGate
                    token={token}
                    generationName={invite.classSet?.familyName ?? null}
                    onFound={setTarget}
                    onRegister={() => switchTo("register")}
                />
            ) : (
                <RegistrationForm
                    key={`${key}|${reason}|${target?.profileId ?? ""}`}
                    token={token}
                    invite={invite}
                    target={target}
                    onUpdateInstead={invite.purpose === "level" ? () => switchTo("update") : undefined}
                />
            )}
        </div>
    );
}

function InviteBlocked({ reason, onRetry }: { reason: string; onRetry: () => void }) {
    return (
        <div className="text-center space-y-6 py-8 max-w-md mx-auto">
            <div className="flex justify-center">
                <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                    <ShieldAlert className="h-8 w-8" aria-hidden="true" />
                </div>
            </div>
            <div>
                <h1 className="text-2xl font-bold text-rcf-navy">This token doesn&apos;t work</h1>
                <p className="text-sm text-slate-500 mt-2">{reason}</p>
            </div>
            <p className="text-xs text-slate-400">
                Tokens are replaced from time to time. Ask your level coordinator for the current one.
            </p>
            <button type="button" onClick={onRetry} className="btn-primary inline-flex h-11 items-center justify-center px-6">
                Enter a token
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Update mode — confirm who you are before editing anything
// ---------------------------------------------------------------------------

/**
 * A level token grants edit rights over the members OF THAT LEVEL, so the first step of
 * an update link is proving you're one of them: enter the email already on record. The
 * server matches it exactly and only within this token's generation, and returns the same
 * message whether the email is unknown or in another level.
 */
function EmailGate({
    token,
    generationName,
    onFound,
    onRegister,
}: {
    token: string;
    generationName: string | null;
    onFound: (t: UpdateTarget) => void;
    onRegister: () => void;
}) {
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        let res: Awaited<ReturnType<typeof lookupLevelMemberAction>>;
        try {
            res = await lookupLevelMemberAction(token, email);
        } catch {
            setBusy(false);
            setError("Couldn't reach the server. Check your connection and try again.");
            return;
        }
        setBusy(false);
        if (res.success) {
            onFound({ profileId: res.profileId, name: res.name, prefill: res.prefill });
        } else {
            setError(res.error || "We couldn't verify that email.");
        }
    };

    return (
        <div className="mx-auto w-full max-w-md space-y-6 py-6">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-rcf-navy">
                    <PencilLine className="h-7 w-7" />
                </div>
                <h1 className="text-2xl font-bold text-rcf-navy">Update your details</h1>
                <p className="mt-2 text-sm text-slate-500">
                    Confirm the email you registered with
                    {generationName ? (
                        <>
                            {" "}
                            in <span className="font-semibold text-rcf-navy">{generationName}</span>
                        </>
                    ) : null}
                    , and we&apos;ll load your record for editing.
                </p>
            </div>

            <form
                onSubmit={submit}
                className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
                <div className="space-y-1">
                    <label htmlFor="lookup-email" className="text-xs font-medium text-gray-700">
                        Email Address
                    </label>
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <FormInput
                            id="lookup-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="pl-9"
                        />
                    </div>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                </div>

                <button
                    type="submit"
                    disabled={busy || !email}
                    className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-60"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Continue
                </button>

                <p className="text-center text-xs text-slate-500">
                    Not registered yet?{" "}
                    <button type="button" onClick={onRegister} className="font-semibold text-rcf-navy hover:underline">
                        Create your record
                    </button>
                </p>
            </form>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Registration form (create / update)
// ---------------------------------------------------------------------------

const STEPS = ["Bio Data", "Academics", "Location"] as const;

function RegistrationForm({
    token,
    invite,
    target,
    onUpdateInstead,
}: {
    token: string;
    invite: Extract<InviteState, { status: "ready" }>;
    /** Set when a LEVEL token is being used to update an existing member. */
    target?: UpdateTarget | null;
    /** Level tokens only: switch this token to "update my details". */
    onUpdateInstead?: () => void;
}) {
    const isUpdate = invite.purpose === "update" || !!target;
    const testDomain = invite.testEmailDomain;
    const [step, setStep] = useState(0);
    const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
    const [serverError, setServerError] = useState("");
    const [emailTaken, setEmailTaken] = useState(false);
    const [done, setDone] = useState(false);
    const [avatar, setAvatar] = useState<{ url: string | null; publicId: string | null }>({
        url: (target?.prefill.avatar_url ?? invite.prefill?.avatar_url) ?? null,
        publicId: null,
    });

    const depts = useDepartments();
    const levelLabel = invite.classSet
        ? computeLevel(invite.classSet.entryYear, invite.classSet.isFoundation, `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`)
        : null;

    const pf = target?.prefill || invite.prefill || {};
    const {
        register,
        handleSubmit,
        trigger,
        getValues,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<RegistrationPayload>({
        defaultValues: {
            firstName: pf.first_name || "",
            lastName: pf.last_name || "",
            middleName: pf.middle_name || "",
            email: pf.email || "",
            phoneNumber: pf.phone_number || "",
            gender: (pf.gender as RegistrationPayload["gender"]) || "",
            dob: pf.dob || "",
            matricNumber: pf.matric_number || "",
            department: pf.department || "",
            schoolAddress: pf.school_address || "",
            homeAddress: pf.home_address || "",
            residentialZoneId: pf.residential_zone_id || "",
        },
    });

    useEffect(() => {
        getZonesAction().then((r) => setZones(r.data || []));
    }, []);

    // Older records hold the department's full name, or a loosely typed code. Once the
    // list is here, point the picker at the matching course code so it shows selected.
    useEffect(() => {
        const current = getValues("department");
        const match = findDepartment(current, depts.departments);
        if (match && match.alias !== current) setValue("department", match.alias);
    }, [depts.departments, getValues, setValue]);

    const stepFields: Record<number, (keyof RegistrationPayload)[]> = {
        0: ["firstName", "lastName", "email", "phoneNumber", "gender"],
        1: ["department"],
        2: ["schoolAddress"],
    };

    const next = async () => {
        const ok = await trigger(stepFields[step]);
        if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
    };

    const onSubmit = async (data: RegistrationPayload) => {
        setServerError("");
        setEmailTaken(false);
        let res: Awaited<ReturnType<typeof submitRegistrationAction>>;
        try {
            res = await submitRegistrationAction(
                token,
                {
                    ...data,
                    avatarUrl: avatar.url ?? undefined,
                    avatarPublicId: avatar.publicId ?? undefined,
                },
                target?.profileId,
            );
        } catch {
            setServerError("Couldn't reach the server. Nothing was saved; check your connection and try again.");
            return;
        }
        if (res.success) {
            setDone(true);
        } else {
            setServerError(res.error || "Something went wrong.");
            setEmailTaken("exists" in res && !!res.exists);
        }
    };

    if (done) {
        return (
            <div className="text-center space-y-6 py-10 max-w-md mx-auto">
                <div className="flex justify-center">
                    <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                        <PartyPopper className="h-8 w-8" />
                    </div>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-rcf-navy">
                        {isUpdate ? "Profile updated" : "You're indexed!"}
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">
                        Your details are saved to the RCF FUTA database
                        {levelLabel ? ` under ${invite.classSet?.familyName || "your generation"} (${levelLabel})` : ""}.
                    </p>
                </div>
                <Link href="/" className="inline-block font-semibold text-rcf-navy hover:underline">
                    Go to homepage
                </Link>
            </div>
        );
    }

    return (
        <>
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-rcf-navy">
                    {isUpdate ? "Update your details" : "Get Indexed"}
                </h1>
                <p className="text-sm text-gray-500">
                    {invite.classSet?.familyName ? (
                        <>
                            Joining <span className="font-semibold text-rcf-navy">{invite.classSet.familyName}</span>
                            {levelLabel ? ` · ${levelLabel}` : ""}
                        </>
                    ) : (
                        "Join the official RCF FUTA digital database."
                    )}
                </p>
            </div>

            {/* Stepper. Registration is sequential (each step gates the next); an UPDATE is
                not — the record already exists, so any section can be jumped to and saved
                from directly, without walking through the ones before it. */}
            <div className="mb-8 flex items-center justify-between px-2">
                {STEPS.map((label, i) => {
                    const dot = (
                        <>
                            <span
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                    step > i
                                        ? "bg-green-500 text-white"
                                        : step === i
                                            ? "bg-rcf-navy text-white ring-4 ring-blue-50"
                                            : "bg-gray-100 text-gray-400"
                                }`}
                            >
                                {step > i ? <Check className="h-4 w-4" /> : i + 1}
                            </span>
                            <span
                                className={`text-[10px] font-medium uppercase tracking-wider ${
                                    step === i ? "text-rcf-navy" : "text-gray-400"
                                }`}
                            >
                                {label}
                            </span>
                        </>
                    );
                    return (
                        <div key={label} className="flex flex-1 items-center last:flex-none">
                            {isUpdate ? (
                                <button
                                    type="button"
                                    onClick={() => setStep(i)}
                                    aria-current={step === i ? "step" : undefined}
                                    className="flex flex-col items-center gap-1 rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy"
                                >
                                    {dot}
                                </button>
                            ) : (
                                <div className="flex flex-col items-center gap-1 p-1">{dot}</div>
                            )}
                            {i < STEPS.length - 1 && (
                                <div
                                    className={`h-1 flex-1 rounded mx-2 transition-colors ${
                                        step > i ? "bg-rcf-navy" : "bg-gray-100"
                                    }`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {!isUpdate && onUpdateInstead && (
                <p className="mb-4 text-center text-xs text-slate-500">
                    Already registered?{" "}
                    <button type="button" onClick={onUpdateInstead} className="font-semibold text-rcf-navy hover:underline">
                        Update your details instead
                    </button>
                </p>
            )}

            {isUpdate && (
                <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Tap any section above to jump straight to it — you can save from anywhere,
                    and every section is submitted together.
                </p>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                {serverError && (
                    <div role="alert" className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
                        {serverError}
                        {emailTaken && onUpdateInstead && (
                            <button type="button" onClick={onUpdateInstead} className="ml-1 font-semibold underline">
                                Update my details
                            </button>
                        )}
                    </div>
                )}

                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                    >
                        {step === 0 && (
                            <>
                                <div className="flex justify-center pb-2">
                                    <AvatarUpload
                                        currentUrl={avatar.url}
                                        initials=""
                                        onUploaded={(img) =>
                                            setAvatar({ url: img?.url ?? null, publicId: img?.publicId ?? null })
                                        }
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Field label="First Name" error={errors.firstName?.message}>
                                        <FormInput {...register("firstName", { required: "First name is required" })} placeholder="John" />
                                    </Field>
                                    <Field label="Last Name" error={errors.lastName?.message}>
                                        <FormInput {...register("lastName", { required: "Last name is required" })} placeholder="Doe" />
                                    </Field>
                                </div>
                                <Field label="Email Address" error={errors.email?.message}>
                                    <FormInput
                                        {...register("email", {
                                            required: "Email is required",
                                            validate: (v) =>
                                                !testDomain
                                                || v.trim().toLowerCase().endsWith(`@${testDomain}`)
                                                || `This is a test environment: use an @${testDomain} email address.`,
                                        })}
                                        type="email"
                                        placeholder={testDomain ? `john@${testDomain}` : "john@example.com"}
                                    />
                                </Field>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Field label="Phone" error={errors.phoneNumber?.message}>
                                        <FormInput {...register("phoneNumber", { required: "Phone is required" })} placeholder="08012345678" />
                                    </Field>
                                    <Field label="Gender" error={errors.gender?.message}>
                                        <FormSelect {...register("gender", { required: "Gender is required" })}>
                                            <option value="">Select</option>
                                            {GENDER_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </FormSelect>
                                    </Field>
                                </div>
                                <Field label="Date of Birth (optional)">
                                    <FormInput {...register("dob")} type="date" />
                                </Field>
                            </>
                        )}

                        {step === 1 && (
                            <>
                                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
                                    Your generation and level are set by your coordinator&apos;s invite — no need to pick them.
                                </div>
                                <Field label="Matric Number (optional for freshers)" error={errors.matricNumber?.message}>
                                    <FormInput {...register("matricNumber")} className="uppercase" placeholder="MEE/19/8821" />
                                </Field>
                                <Field label="Department" error={errors.department?.message}>
                                    <DepartmentSelect
                                        departments={depts.departments}
                                        loading={depts.loading}
                                        error={depts.error}
                                        onRetry={depts.retry}
                                        currentValue={pf.department}
                                        {...register("department", { required: "Department is required" })}
                                    />
                                </Field>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <Field label="School Address" error={errors.schoolAddress?.message}>
                                    <FormInput {...register("schoolAddress", { required: "School address is required" })} placeholder="Hall / off-campus address" />
                                </Field>
                                <Field label="Home Address (optional)">
                                    <FormInput {...register("homeAddress")} placeholder="Permanent home address" />
                                </Field>
                                <Field label="Residential Zone (optional)">
                                    <FormSelect {...register("residentialZoneId")}>
                                        <option value="">Select zone</option>
                                        {zones.map((z) => (
                                            <option key={z.id} value={z.id}>
                                                {z.name}
                                            </option>
                                        ))}
                                    </FormSelect>
                                </Field>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="mt-6 flex flex-wrap gap-3">
                    {step > 0 && (
                        <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                    )}
                    {step < STEPS.length - 1 && (
                        <button type="button" onClick={next} className="btn-primary flex-1 flex items-center justify-center gap-2">
                            Next <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                    {/* On an update, Save is always available: the whole form is submitted at
                        once, so a change made on the last section doesn't have to be reached
                        by re-saving the ones before it. */}
                    {(isUpdate || step === STEPS.length - 1) && (
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isUpdate ? "Save changes" : "Complete registration"}
                        </button>
                    )}
                </div>
            </form>
        </>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">{label}</label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}
