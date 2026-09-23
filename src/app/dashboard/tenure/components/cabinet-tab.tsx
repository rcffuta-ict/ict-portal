/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState } from "react";
import {
    assignLeaderAction,
    togglePositionAction,
    setPositionPrivilegesAction,
    removeUnitLeaderAction,
} from "../actions";
import {
    Search,
    UserCheck,
    Settings,
    Plus,
    Power,
    List,
    Trash2,
    Loader2,
    Pencil,
    X,
    ChevronRight,
} from "lucide-react";
import { AlertModal, useAlertModal } from "@/components/ui/alert-modal";
import { PrivilegeBuilder } from "./privilege-builder";
import Link from "next/link";
import { PrivilegePills } from "./privilege-pills";
import { OfficeStep } from "./appoint/office-step";
import { LevelStep } from "./appoint/level-step";
import { MemberStep } from "./appoint/member-step";
import { normalizePrivileges } from "@/lib/privileges";
import type { Privilege } from "@/lib/modules";

export function CabinetTab({ data, onSuccess }: any) {
    const [mode, setMode] = useState<"LIST" | "APPOINT" | "CONFIGURE">("LIST");
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    return (
        <>
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            <div className="mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="font-bold text-slate-900">Leadership Management</h3>
                        <p className="text-xs text-slate-500">
                            Active Tenure: {data?.activeTenure?.name}
                        </p>
                    </div>

                    <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                        {(
                            [
                                ["LIST", List, "Roster"],
                                ["APPOINT", UserCheck, "Appoint"],
                                ["CONFIGURE", Settings, "Roles"],
                            ] as const
                        ).map(([m, Icon, label]) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                                    mode === m
                                        ? "bg-rcf-navy text-white shadow-sm"
                                        : "text-slate-500 hover:bg-slate-50"
                                }`}
                            >
                                <Icon className="h-3 w-3" /> {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-0 sm:p-8">
                    {mode === "LIST" && (
                        <RosterView data={data} onSuccess={onSuccess} showAlert={showAlert} />
                    )}
                    {mode === "APPOINT" && (
                        <AppointmentView
                            data={data}
                            onSuccess={() => {
                                onSuccess();
                                setMode("LIST");
                            }}
                            showAlert={showAlert}
                        />
                    )}
                    {mode === "CONFIGURE" && (
                        <ConfigurationView data={data} onSuccess={onSuccess} showAlert={showAlert} />
                    )}
                </div>
            </div>
        </>
    );
}

/**
 * Whether ending the appointment keeps it on the member's service record.
 *
 * Checked by default, and the wording says what each choice MEANS rather than naming
 * the mechanism: an admin ending a real appointment should not have to think, and the
 * only reason to uncheck is the appointment that never should have existed.
 */
function KeepHistoryChoice({ onChange }: { onChange: (keep: boolean) => void }) {
    const [keep, setKeep] = useState(true);
    return (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
                type="checkbox"
                checked={keep}
                onChange={(e) => { setKeep(e.target.checked); onChange(e.target.checked); }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-rcf-navy"
            />
            <span className="text-xs leading-relaxed text-slate-600">
                <span className="font-bold text-slate-900">
                    Keep this on their service record
                </span>
                <span className="mt-0.5 block">
                    {keep
                        ? "It will show on their profile as an office they served in, with the session."
                        : "The appointment will be deleted outright, as though it never happened. Use this only for an appointment made by mistake."}
                </span>
            </span>
        </label>
    );
}

// --- SUB-COMPONENT 1: ROSTER ---
function RosterView({ data, onSuccess, showAlert }: any) {
    const leaders = data?.leadership || [];
    const [search, setSearch] = useState("");

    const filtered = leaders.filter(
        (l: any) =>
            l.profile.first_name.toLowerCase().includes(search.toLowerCase()) ||
            l.profile.last_name.toLowerCase().includes(search.toLowerCase()) ||
            l.position.title.toLowerCase().includes(search.toLowerCase()),
    );

    // A ref, not state: `onConfirm` is a closure captured when the dialog opens, so it
    // would otherwise read whatever the checkbox was set to BEFORE the admin touched it.
    const keepHistoryRef = useRef(true);

    const handleRevoke = async (leader: any) => {
        keepHistoryRef.current = true;
        const who = `${leader.profile.first_name} ${leader.profile.last_name}`;
        const office = leader.position?.alias || leader.position?.title || "this office";

        showAlert({
            type: "warning",
            title: "End this appointment?",
            message: `${who} will stop holding ${office} and lose any access it granted, `
                + "effective immediately.",
            confirmText: "End appointment",
            children: <KeepHistoryChoice onChange={(v) => { keepHistoryRef.current = v; }} />,
            onConfirm: async () => {
                const res = await removeUnitLeaderAction(leader.id, keepHistoryRef.current);
                if (res.success) onSuccess();
                else showAlert({ type: "error", message: res.error });
            },
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-4 sm:px-0">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search roster..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-rcf-navy"
                    />
                </div>
                <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    Total: {filtered.length}
                </div>
            </div>

            <div className="border-t border-slate-100 overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Role</th>
                            <th className="px-6 py-3">Priviledges</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400">
                                    No leaders found.
                                </td>
                            </tr>
                        )}
                        {filtered.map((l: any) => (
                            <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                            {l.profile.first_name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">
                                                {l.profile.first_name} {l.profile.last_name}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                                {l.profile.phone_number}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-medium text-slate-700">
                                            {l.position.title}
                                        </span>
                                        {l.is_lead === false && (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                                                Assistant
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <PrivilegePills
                                        privileges={l.position?.position_privileges}
                                        slug={l.position?.slug}
                                        emptyLabel="—"
                                    />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleRevoke(l)}
                                        className="text-slate-300 hover:text-red-500 transition-colors p-2"
                                        aria-label="Revoke leadership"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// --- SUB-COMPONENT 2: APPOINT ---
/**
 * Appointment, in three steps: office -> generation -> member.
 *
 * The old flow went the other way -- search the whole fellowship, then choose from a
 * dropdown of thirty-six offices. Two things were wrong with that. You had to know who
 * you wanted before the screen told you what you were filling, and the search was a
 * bare box over several hundred people with a 500ms debounce and a server round-trip
 * per keystroke.
 *
 * Starting from the office lets every later step narrow itself: the generation grid
 * knows which level to expect, and the member list knows which offices its candidates
 * already hold.
 */
function AppointmentView({ data, onSuccess, showAlert }: any) {
    const [office, setOffice] = useState<any>(null);
    const [generation, setGeneration] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);

    const step = !office ? 1 : !generation ? 2 : 3;

    // Who already leads the chosen office, if anyone.
    //
    // assignLeaderAction REFUSES a second lead (and leadership_one_lead_per_position
    // refuses it again in the database), so appointing over a sitting holder was never
    // possible -- but you only found out after walking all three steps. Resolving it
    // here means step 3 can say so up front and offer the thing that will actually work.
    const sittingLead = office
        ? (data?.leadership ?? []).find(
            (l: any) => l.position_id === office.id && l.is_lead !== false,
        )
        : null;

    const handleConfirm = async (member: any, isLead: boolean) => {
        if (!data?.activeTenure) return;
        setSubmitting(true);
        const formData = new FormData();
        formData.append("profileId", member.id);
        formData.append("positionId", office.id);
        formData.append("tenureId", data.activeTenure.id);
        formData.append("isLead", isLead ? "true" : "false");

        const res = await assignLeaderAction(formData);
        setSubmitting(false);

        if (!res.success) {
            showAlert({ type: "error", message: res.error });
            return;
        }
        if (res.warning) {
            showAlert({ type: "error", message: res.warning });
        } else {
            // Appointment also grants portal access, so say so -- otherwise nobody knows
            // to tell the appointee they can now sign in and set a password.
            showAlert({
                type: "success",
                message: res.loginCreated
                    ? `${member.first_name} appointed. They can now sign in and set their password.`
                    : `${member.first_name} appointed as ${office.alias || office.title}.`,
            });
        }
        setOffice(null);
        setGeneration(null);
        onSuccess();
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-0">
            {/* Breadcrumb. Each completed step is a button, because changing your mind
                about the office should not mean starting over. */}
            <nav aria-label="Appointment progress" className="flex flex-wrap items-center gap-1 text-xs">
                {([
                    [1, office ? (office.alias || office.title) : "Office", () => { setOffice(null); setGeneration(null); }],
                    [2, generation ? generation.levelLabel : "Generation", () => setGeneration(null)],
                    [3, "Member", () => {}],
                ] as const).map(([index, label, reset], i) => (
                    <span key={index} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                        <button
                            type="button"
                            disabled={index >= step}
                            onClick={reset}
                            className={`rounded px-2 py-1 font-bold transition-colors ${
                                index === step
                                    ? "bg-rcf-navy text-white"
                                    : index < step
                                        ? "text-rcf-navy hover:bg-slate-100"
                                        : "text-slate-300"
                            }`}
                        >
                            {label}
                        </button>
                    </span>
                ))}
            </nav>

            {step === 1 && (
                <OfficeStep
                    positions={data?.positions ?? []}
                    leadership={data?.leadership ?? []}
                    onPick={setOffice}
                />
            )}

            {step === 2 && (
                <LevelStep
                    office={office}
                    families={data?.families ?? []}
                    session={data?.activeTenure?.session ?? null}
                    onPick={setGeneration}
                />
            )}

            {step === 3 && (
                <MemberStep
                    key={generation.id}
                    office={office}
                    generation={generation}
                    sittingLead={sittingLead}
                    onConfirm={handleConfirm}
                    submitting={submitting}
                />
            )}
        </div>
    );
}

// --- SUB-COMPONENT 3: ROLES / CONFIGURE ---
function ConfigurationView({ data, onSuccess, showAlert }: any) {
    const units = (data?.units ?? []).map((u: any) => ({
        id: u.id,
        name: u.name,
        type: u.type,
        slug: u.slug,
    }));

    // Edit-privileges modal state.
    const [editing, setEditing] = useState<any | null>(null);

    async function toggleStatus(id: string, currentStatus: boolean, posData: any) {
        showAlert({
            type: "warning",
            title: `${currentStatus ? "Deactivate" : "Activate"} Role?`,
            message: `Are you sure you want to ${currentStatus ? "deactivate" : "activate"} this role?`,
            confirmText: currentStatus ? "Deactivate" : "Activate",
            onConfirm: async () => {
                await togglePositionAction(id, currentStatus, posData);
                onSuccess();
            },
        });
    }

    return (
        <div className="grid gap-8 lg:grid-cols-3 animate-in slide-in-from-right-4 px-4 sm:px-0">
            {/* Creating an office lives on its own page now.
                It adds a node to the administrative hierarchy and a row of privilege
                tags -- a different kind of act from editing a roster, and one that
                should not sit a misclick away from the screen used every week. */}
            <div className="lg:col-span-1">
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h4 className="flex items-center gap-2 font-bold text-slate-900">
                        <Plus className="h-4 w-4" /> New office
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-500">
                        The catalogue is frozen: President, the Vice Presidents, the ICT
                        Coordinator and the Level Coordinators are constant across tenures.
                        The one office that can legitimately be missing is a new unit&rsquo;s
                        Executive.
                    </p>
                    <Link
                        href="/dashboard/tenure/offices/new"
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-rcf-navy px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
                    >
                        Create an Executive office
                    </Link>
                    <p className="text-[11px] text-slate-400">
                        Privileges for an office that already exists are edited in the table
                        beside this.
                    </p>
                </div>
            </div>

            {/* Positions table */}
            <div className="lg:col-span-2 border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[520px]">
                        <thead className="bg-slate-100 text-slate-500 font-bold text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">Priviledges</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data?.positions?.map((pos: any) => {
                                const isSysAdmin = pos.slug === "ict-coord";
                                return (
                                    <tr key={pos.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900 align-top">
                                            {pos.title}
                                            {pos.slug && (
                                                <span className="block font-mono text-[10px] font-normal text-slate-400">
                                                    {pos.slug}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <PrivilegePills
                                                privileges={pos.position_privileges}
                                                slug={pos.slug}
                                                emptyLabel="None"
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="flex items-center justify-end gap-3">
                                                {!isSysAdmin && (
                                                    <button
                                                        onClick={() =>
                                                            setEditing({
                                                                ...pos,
                                                                _privileges: normalizePrivileges(
                                                                    pos.position_privileges,
                                                                ),
                                                            })
                                                        }
                                                        title="Edit privileges"
                                                        className="text-xs font-bold text-rcf-navy hover:text-rcf-navy-light flex items-center gap-1"
                                                    >
                                                        <Pencil className="h-3 w-3" /> Edit
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => toggleStatus(pos.id, pos.is_active, pos)}
                                                    className={`text-xs font-bold flex items-center gap-1 ${
                                                        pos.is_active
                                                            ? "text-green-600 hover:text-green-800"
                                                            : "text-slate-400 hover:text-slate-600"
                                                    }`}
                                                >
                                                    <Power className="h-3 w-3" />
                                                    {pos.is_active ? "Active" : "Inactive"}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {editing && (
                <EditPrivilegesModal
                    position={editing}
                    units={units}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        onSuccess();
                    }}
                    showAlert={showAlert}
                />
            )}
        </div>
    );
}

function EditPrivilegesModal({ position, units, onClose, onSaved, showAlert }: any) {
    const [privileges, setPrivileges] = useState<Privilege[]>(position._privileges ?? []);
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        const res = await setPositionPrivilegesAction(position.id, privileges);
        setSaving(false);
        if (res.success) onSaved();
        else showAlert({ type: "error", message: res.error });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-slate-900">Edit Privileges</h3>
                        <p className="text-xs text-slate-500">{position.title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5 text-slate-500" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <PrivilegeBuilder value={privileges} onChange={setPrivileges} units={units} />
                </div>
                <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-4 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-white"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="flex-1 py-2.5 bg-rcf-navy text-white rounded-xl text-sm font-bold hover:bg-opacity-90 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {saving ? "Saving…" : "Save Privileges"}
                    </button>
                </div>
            </div>
        </div>
    );
}
