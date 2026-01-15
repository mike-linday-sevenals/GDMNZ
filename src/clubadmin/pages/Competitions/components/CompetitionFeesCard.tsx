import { useEffect, useMemo, useState } from "react";
import {
    getCompetitionFees,
    upsertCompetitionFees,
    type CompetitionFees
} from "@/clubadmin/api/competitionFees";
import { getCompetition } from "@/clubadmin/api/competitions";

/* ======================================================================
   TYPES
   ====================================================================== */

type Props = {
    organisationId: string;
    competitionId: string;
};

type ValidationMessage = {
    key: string;
    text: string;
};

/* ======================================================================
   VALIDATION PATTERN REDUCER
   ====================================================================== */

function buildFeeWarnings(fees: CompetitionFees): ValidationMessage[] {
    const warnings: ValidationMessage[] = [];

    const {
        earlybird_fee_adult,
        earlybird_fee_junior,
        full_fee_adult,
        full_fee_junior,
        nonmember_fee_adult,
        nonmember_fee_junior
    } = fees;

    const anyEarlyBirdHigherThanFull =
        (earlybird_fee_adult != null &&
            full_fee_adult != null &&
            earlybird_fee_adult > full_fee_adult) ||
        (earlybird_fee_junior != null &&
            full_fee_junior != null &&
            earlybird_fee_junior > full_fee_junior);

    if (anyEarlyBirdHigherThanFull) {
        warnings.push({
            key: "earlybird-higher-than-full",
            text:
                "Early bird pricing is higher than standard registration pricing. " +
                "Early bird fees are usually the same or cheaper than full fees."
        });
    }

    const anyJuniorHigherThanAdult =
        (earlybird_fee_adult != null &&
            earlybird_fee_junior != null &&
            earlybird_fee_junior > earlybird_fee_adult) ||
        (full_fee_adult != null &&
            full_fee_junior != null &&
            full_fee_junior > full_fee_adult) ||
        (nonmember_fee_adult != null &&
            nonmember_fee_junior != null &&
            nonmember_fee_junior > nonmember_fee_adult);

    if (anyJuniorHigherThanAdult) {
        warnings.push({
            key: "junior-higher-than-adult",
            text:
                "Junior pricing is higher than adult pricing. " +
                "Junior fees are usually the same or lower than adult fees."
        });
    }

    const anyNonMemberCheaperThanMember =
        (nonmember_fee_adult != null &&
            full_fee_adult != null &&
            nonmember_fee_adult < full_fee_adult) ||
        (nonmember_fee_junior != null &&
            full_fee_junior != null &&
            nonmember_fee_junior < full_fee_junior);

    if (anyNonMemberCheaperThanMember) {
        warnings.push({
            key: "nonmember-cheaper-than-member",
            text:
                "Non-member pricing is lower than member pricing. " +
                "Non-member fees are usually the same or higher than member fees."
        });
    }

    return warnings;
}

/* ======================================================================
   COMPONENT
   ====================================================================== */

export default function CompetitionFeesCard({
    organisationId,
    competitionId
}: Props) {
    const [fees, setFees] = useState<CompetitionFees | null>(null);
    const [draft, setDraft] = useState<CompetitionFees | null>(null);

    const [competitionStart, setCompetitionStart] = useState<string | null>(
        null
    );

    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    const [showConfirm, setShowConfirm] = useState(false);

    /* ================================================================
       LOAD
       ================================================================ */

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);

            const [feeData, comp] = await Promise.all([
                getCompetitionFees(organisationId, competitionId),
                getCompetition(organisationId, competitionId)
            ]);

            if (cancelled) return;

            setFees(feeData);
            setDraft(feeData);
            setCompetitionStart(comp?.starts_at ?? null);
            setDirty(false);
            setEditing(false);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [organisationId, competitionId]);

    /* ================================================================
       HELPERS
       ================================================================ */

    function updateDraft<K extends keyof CompetitionFees>(
        key: K,
        value: CompetitionFees[K]
    ) {
        setDraft(d => {
            if (!d || !fees) return d;
            const next = { ...d, [key]: value };
            setDirty(JSON.stringify(next) !== JSON.stringify(fees));
            return next;
        });
    }

    const warnings = useMemo(
        () => (draft ? buildFeeWarnings(draft) : []),
        [draft]
    );

    async function commitSave() {
        if (!draft) return;

        setSaving(true);
        try {
            const saved = await upsertCompetitionFees(
                organisationId,
                competitionId,
                draft
            );
            setFees(saved);
            setDraft(saved);
            setDirty(false);
            setEditing(false);
        } finally {
            setSaving(false);
            setShowConfirm(false);
        }
    }

    async function saveFees() {
        if (!draft) return;

        if (warnings.length > 0) {
            setShowConfirm(true);
            return;
        }

        await commitSave();
    }

    function cancelEdit() {
        setDraft(fees);
        setDirty(false);
        setEditing(false);
    }

    /* ================================================================
       RENDER
       ================================================================ */

    if (loading) return <div className="card">Loading fees…</div>;
    if (!draft) return <div className="card">No fee configuration found.</div>;

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h3>Registration Fees</h3>

                    {!editing ? (
                        <button
                            className="btn btn--sm"
                            onClick={() => setEditing(true)}
                        >
                            Edit
                        </button>
                    ) : (
                        <button
                            className="btn btn--sm btn--ghost"
                            onClick={cancelEdit}
                        >
                            Cancel
                        </button>
                    )}
                </div>

                {/* Early bird date */}
                <div className="fee-date-row">
                    <label>Early bird cutoff date</label>
                    <input
                        type="date"
                        className="date-input--compact"
                        value={draft.earlybird_cutoff_date ?? ""}
                        max={competitionStart ?? undefined}
                        disabled={!editing}
                        onChange={e =>
                            updateDraft(
                                "earlybird_cutoff_date",
                                e.target.value || null
                            )
                        }
                    />
                    {competitionStart && (
                        <div className="muted">
                            Must be on or before competition start (
                            {new Date(competitionStart).toLocaleDateString(
                                "en-NZ"
                            )}
                            )
                        </div>
                    )}
                </div>

                <div className="fees-grid">
                    <FeeBlock
                        title="Early bird (members)"
                        adult={draft.earlybird_fee_adult}
                        junior={draft.earlybird_fee_junior}
                        disabled={!editing}
                        onChange={(a, j) => {
                            updateDraft("earlybird_fee_adult", a);
                            updateDraft("earlybird_fee_junior", j);
                        }}
                    />

                    <FeeBlock
                        title="Full fees (members)"
                        adult={draft.full_fee_adult}
                        junior={draft.full_fee_junior}
                        disabled={!editing}
                        onChange={(a, j) => {
                            updateDraft("full_fee_adult", a);
                            updateDraft("full_fee_junior", j);
                        }}
                    />

                    <FeeBlock
                        title="Non-member fees"
                        adult={draft.nonmember_fee_adult}
                        junior={draft.nonmember_fee_junior}
                        disabled={!editing}
                        onChange={(a, j) => {
                            updateDraft("nonmember_fee_adult", a);
                            updateDraft("nonmember_fee_junior", j);
                        }}
                    />
                </div>

                {editing && (
                    <div className="card-actions">
                        <button
                            className="btn primary"
                            onClick={saveFees}
                            disabled={saving}
                        >
                            {saving ? "Saving…" : "Save fees"}
                        </button>
                    </div>
                )}
            </div>

            {/* ================= CONFIRM MODAL ================= */}
            {showConfirm && (
                <div className="modal-backdrop">
                    <div className="modal card">
                        <h3>Please confirm registration fees</h3>

                        <p>The following fee settings look unusual:</p>

                        <ul>
                            {warnings.map(w => (
                                <li key={w.key}>{w.text}</li>
                            ))}
                        </ul>

                        <p className="muted">
                            You can still save these fees if this configuration
                            is intentional.
                        </p>

                        <div className="modal-actions">
                            <button
                                className="btn btn--ghost"
                                onClick={() => setShowConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn primary"
                                onClick={commitSave}
                            >
                                Save anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/* ======================================================================
   SUBCOMPONENTS
   ====================================================================== */

type FeeBlockProps = {
    title: string;
    adult: number | null;
    junior: number | null;
    disabled: boolean;
    onChange: (adult: number | null, junior: number | null) => void;
};

function FeeBlock({
    title,
    adult,
    junior,
    disabled,
    onChange
}: FeeBlockProps) {
    return (
        <div className="fee-block">
            <h4>{title}</h4>
            <CurrencyInput
                label="Adult"
                value={adult}
                disabled={disabled}
                onChange={v => onChange(v, junior)}
            />
            <CurrencyInput
                label="Junior"
                value={junior}
                disabled={disabled}
                onChange={v => onChange(adult, v)}
            />
        </div>
    );
}

type CurrencyInputProps = {
    label: string;
    value: number | null;
    disabled: boolean;
    onChange: (value: number | null) => void;
};

function CurrencyInput({
    label,
    value,
    disabled,
    onChange
}: CurrencyInputProps) {
    return (
        <div className="fee-input">
            <label>{label}</label>
            <div className="currency-input">
                <span className="currency-prefix">$</span>
                <input
                    type="number"
                    min={0}
                    step={1}
                    value={value ?? ""}
                    disabled={disabled}
                    onChange={e =>
                        onChange(
                            e.target.value === ""
                                ? null
                                : Number(e.target.value)
                        )
                    }
                />
            </div>
        </div>
    );
}
