import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getCompetitionBySlug,
    joinBoat,
    registerBoatWithTeam,
    type JoinBoatResult,
    type RegisterBoatResult,
    type BoatType,
    type PersonCategory,
} from "@/services/api";

type Mode = "create" | "join";

type Person = {
    full_name: string;
    membership_no: string;
    email: string;
    phone: string;
    category: PersonCategory;
};

const emptyPerson = (): Person => ({
    full_name: "",
    membership_no: "",
    email: "",
    phone: "",
    category: "adult",
});

const normaliseCategory = (value?: string | null): PersonCategory => {
    const v = value?.trim().toLowerCase();
    if (v === "adult" || v === "junior" || v === "senior") return v;
    return "adult";
};

const sanitizeText = (value?: string | null) =>
    (value ?? "").replace(/\uFFFD/g, "").trim();

export default function PublicRegister() {
    const { slug } = useParams<{ slug: string }>();

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [competition, setCompetition] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [mode, setMode] = useState<Mode>("create");

    // Create mode
    const [boatName, setBoatName] = useState("");
    const [boatType, setBoatType] = useState<BoatType | "">("");
    const [joinCode, setJoinCode] = useState("");
    const [skipper, setSkipper] = useState<Person>(emptyPerson());
    const [team, setTeam] = useState<Person[]>([]);

    // Join mode
    const [joinBoatNumber, setJoinBoatNumber] = useState("");
    const [joinBoatName, setJoinBoatName] = useState("");
    const [joinBoatPin, setJoinBoatPin] = useState("");
    const [joinPerson, setJoinPerson] = useState<Person>(emptyPerson());

    // Result
    const [result, setResult] = useState<
        | ({ kind: "create"; data: RegisterBoatResult })
        | ({ kind: "join"; data: JoinBoatResult })
        | null
    >(null);

    const registrationDate = useMemo(
        () => new Date().toISOString().slice(0, 10),
        []
    );

    useEffect(() => {
        if (!slug) return;
        (async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const comp = await getCompetitionBySlug(slug);
                setCompetition(comp ? { id: comp.id, name: comp.name } : null);
            } catch (e: any) {
                setLoadError(e?.message ?? "Failed to load competition");
                setCompetition(null);
            } finally {
                setLoading(false);
            }
        })();
    }, [slug]);

    const canSubmitCreate = useMemo(() => {
        return (
            !!competition &&
            boatName.trim().length > 0 &&
            skipper.full_name.trim().length > 0 &&
            team.every(
                p =>
                    p.full_name.trim().length > 0 ||
                    p.membership_no.trim().length > 0
            )
        );
    }, [competition, boatName, skipper, team]);

    const canSubmitJoin = useMemo(() => {
        return (
            !!competition &&
            joinBoatNumber.trim().length > 0 &&
            joinPerson.full_name.trim().length > 0
        );
    }, [competition, joinBoatNumber, joinPerson]);

    const handleAddTeamMember = () => setTeam(t => [...t, emptyPerson()]);
    const handleUpdateTeam = (idx: number, patch: Partial<Person>) =>
        setTeam(t => t.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    const handleRemoveTeam = (idx: number) =>
        setTeam(t => t.filter((_, i) => i !== idx));

    const handleSubmit = async () => {
        if (!competition) return;
        setErrorMsg(null);
        setLoading(true);
        try {
            if (mode === "create") {
                const payload = {
                    competition_id: competition.id,
                    boat_name: boatName.trim(),
                    boat_type: boatType || null,
                    join_code: joinCode.trim() || null,
                    skipper: {
                        full_name: skipper.full_name.trim(),
                        membership_no: skipper.membership_no.trim() || null,
                        email: skipper.email.trim() || null,
                        phone: skipper.phone.trim() || null,
                        category: normaliseCategory(skipper.category),
                    },
                    team: team
                        .filter(
                            p =>
                                p.full_name.trim() ||
                                p.membership_no.trim()
                        )
                        .map(p => ({
                            full_name: p.full_name.trim(),
                            membership_no: p.membership_no.trim() || null,
                            email: p.email.trim() || null,
                            phone: p.phone.trim() || null,
                            category: normaliseCategory(p.category),
                        })),
                };
                console.log("[PublicRegister] create submission payload", payload);
                const data = await registerBoatWithTeam(payload);
                setResult({ kind: "create", data });
            } else {
                const payload = {
                    competition_id: competition.id,
                    boat_number: joinBoatNumber.trim(),
                    boat_name: joinBoatName.trim() || null,
                    join_code: joinBoatPin.trim() || null,
                    member: {
                        full_name: joinPerson.full_name.trim(),
                        membership_no: joinPerson.membership_no.trim() || null,
                        email: joinPerson.email.trim() || null,
                        phone: joinPerson.phone.trim() || null,
                        category: normaliseCategory(joinPerson.category),
                    },
                };
                console.log("[PublicRegister] join submission payload", payload);
                const data = await joinBoat(payload);
                setResult({ kind: "join", data });
            }
        } catch (err: any) {
            console.error("[PublicRegister] submission failed", err);
            setErrorMsg(
                err?.message ?? "Registration failed. Please try again or see staff."
            );
        } finally {
            setLoading(false);
        }
    };

    if (loading && !competition && !loadError) {
        return <div style={{ padding: 16 }}>Loading...</div>;
    }

    if (loadError) {
        return (
            <div style={{ padding: 16, color: "#b91c1c" }}>
                Error: {loadError}
            </div>
        );
    }

    if (!competition) {
        return <div style={{ padding: 16 }}>Competition not found.</div>;
    }

    if (result) {
        const boatNumber = sanitizeText(result.data.boat_number);
        const anglers =
            result.kind === "create"
                ? result.data.anglers
                : [result.data.angler];
        return (
            <div style={{ padding: 16, maxWidth: 600, margin: "0 auto" }}>
                <h2>{competition.name}</h2>
                <h3>Registration Confirmed</h3>
                <p>
                    Boat Number: <strong>{boatNumber}</strong>
                </p>
                <ul>
                    {anglers.map(a => {
                        const cleanNumber = sanitizeText(
                            (a as any)?.angler_number
                        );
                        const cleanRole = sanitizeText(
                            (a as any)?.role ?? (a as any)?.full_name
                        );
                        return (
                            <li key={cleanNumber || (a as any)?.competitor_id}>
                                {cleanNumber}
                                {cleanRole ? ` - ${cleanRole}` : ""}
                            </li>
                        );
                    })}
                </ul>
                <p style={{ marginTop: 16 }}>
                    Show this screen to staff for check-in.
                </p>
            </div>
        );
    }

    return (
        <div style={{ padding: 16, maxWidth: 700, margin: "0 auto" }}>
            <h2>{competition.name}</h2>
            <p style={{ color: "#666", marginBottom: 12 }}>
                Registration date: {registrationDate}
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                    type="button"
                    className={`pill pill--clickable ${
                        mode === "create" ? "pill--green" : "pill--muted"
                    }`}
                    onClick={() => setMode("create")}
                >
                    Create a new boat
                </button>
                <button
                    type="button"
                    className={`pill pill--clickable ${
                        mode === "join" ? "pill--green" : "pill--muted"
                    }`}
                    onClick={() => setMode("join")}
                >
                    Join existing boat
                </button>
            </div>

            {errorMsg && (
                <div
                    style={{
                        background: "#fef2f2",
                        color: "#b91c1c",
                        padding: 10,
                        borderRadius: 6,
                        marginBottom: 12,
                    }}
                >
                    {errorMsg}
                </div>
            )}

            {mode === "create" ? (
                <div className="card" style={{ padding: 12 }}>
                    <div className="field" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <label>Boat name *</label>
                        <input
                            value={boatName}
                            onChange={e => setBoatName(e.target.value)}
                            placeholder="Boat name"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div className="field" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        <label>Boat type</label>
                        <select
                            value={boatType}
                            onChange={e =>
                                setBoatType(
                                    (e.target.value || "") as BoatType | ""
                                )
                            }
                            style={{ width: "100%" }}
                        >
                            <option value="">- Select -</option>
                            <option value="Launch">Launch</option>
                            <option value="Trailer">Trailer</option>
                            <option value="Charter">Charter</option>
                        </select>
                    </div>
                    <div className="field" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        <label>Join code / PIN (optional)</label>
                        <input
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value)}
                            placeholder="PIN to share with team"
                            style={{ width: "100%" }}
                        />
                    </div>

                    <div className="field" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                        <label>Skipper / Primary angler *</label>
                        <input
                            value={skipper.full_name}
                            onChange={e =>
                                setSkipper({
                                    ...skipper,
                                    full_name: e.target.value,
                                })
                            }
                            placeholder="Full name"
                            style={{ width: "100%" }}
                        />
                        <input
                            value={skipper.membership_no}
                            onChange={e =>
                                setSkipper({
                                    ...skipper,
                                    membership_no: e.target.value,
                                })
                            }
                            placeholder="Membership # (optional)"
                            style={{ width: "100%" }}
                        />
                        <input
                            value={skipper.email}
                            onChange={e =>
                                setSkipper({
                                    ...skipper,
                                    email: e.target.value,
                                })
                            }
                            placeholder="Email (optional)"
                            style={{ width: "100%" }}
                        />
                        <input
                            value={skipper.phone}
                            onChange={e =>
                                setSkipper({
                                    ...skipper,
                                    phone: e.target.value,
                                })
                            }
                            placeholder="Phone (optional)"
                            style={{ width: "100%" }}
                        />
                    </div>

                    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                        <strong>Team members</strong>
                        {team.map((p, i) => (
                            <div
                                key={i}
                                style={{
                                    border: "1px solid #e5e7eb",
                                    padding: 10,
                                    borderRadius: 6,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    width: "100%",
                                }}
                            >
                                <input
                                    value={p.full_name}
                                    onChange={e =>
                                        handleUpdateTeam(i, {
                                            full_name: e.target.value,
                                        })
                                    }
                                    placeholder="Full name"
                                    style={{ width: "100%" }}
                                />
                                <input
                                    value={p.membership_no}
                                    onChange={e =>
                                        handleUpdateTeam(i, {
                                            membership_no: e.target.value,
                                        })
                                    }
                                    placeholder="Membership # (optional)"
                                    style={{ width: "100%" }}
                                />
                                <input
                                    value={p.email}
                                    onChange={e =>
                                        handleUpdateTeam(i, {
                                            email: e.target.value,
                                        })
                                    }
                                    placeholder="Email (optional)"
                                    style={{ width: "100%" }}
                                />
                                <input
                                    value={p.phone}
                                    onChange={e =>
                                        handleUpdateTeam(i, {
                                            phone: e.target.value,
                                        })
                                    }
                                    placeholder="Phone (optional)"
                                    style={{ width: "100%" }}
                                />
                                <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={() => handleRemoveTeam(i)}
                                    style={{ alignSelf: "flex-end", marginTop: 4 }}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            className="btn secondary"
                            style={{ marginTop: 4, width: "100%" }}
                            onClick={handleAddTeamMember}
                        >
                            + Add Team Member
                        </button>
                    </div>

                    <button
                        className="btn primary"
                        style={{ width: "100%", marginTop: 16 }}
                        disabled={!canSubmitCreate || loading}
                        onClick={handleSubmit}
                    >
                        {loading ? "Submitting..." : "Submit & Get Numbers"}
                    </button>
                </div>
            ) : (
                <div className="card" style={{ padding: 12 }}>
                    <div className="field" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <label>Boat number *</label>
                        <input
                            value={joinBoatNumber}
                            onChange={e => setJoinBoatNumber(e.target.value)}
                            placeholder="e.g., B00123"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div className="field" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        <label>Boat name (for verification)</label>
                        <input
                            value={joinBoatName}
                            onChange={e => setJoinBoatName(e.target.value)}
                            placeholder="Optional, helps verify"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div className="field" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        <label>Join code / PIN (if provided)</label>
                        <input
                            value={joinBoatPin}
                            onChange={e => setJoinBoatPin(e.target.value)}
                            placeholder="PIN from skipper"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div className="field" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        <label>Your details *</label>
                        <input
                            value={joinPerson.full_name}
                            onChange={e =>
                                setJoinPerson({
                                    ...joinPerson,
                                    full_name: e.target.value,
                                })
                            }
                            placeholder="Full name"
                            style={{ width: "100%" }}
                        />
                        <input
                            value={joinPerson.membership_no}
                            onChange={e =>
                                setJoinPerson({
                                    ...joinPerson,
                                    membership_no: e.target.value,
                                })
                            }
                            placeholder="Membership # (optional)"
                            style={{ width: "100%" }}
                        />
                        <input
                            value={joinPerson.email}
                            onChange={e =>
                                setJoinPerson({
                                    ...joinPerson,
                                    email: e.target.value,
                                })
                            }
                            placeholder="Email (optional)"
                            style={{ width: "100%" }}
                        />
                        <input
                            value={joinPerson.phone}
                            onChange={e =>
                                setJoinPerson({
                                    ...joinPerson,
                                    phone: e.target.value,
                                })
                            }
                            placeholder="Phone (optional)"
                            style={{ width: "100%" }}
                        />
                    </div>

                    <button
                        className="btn primary"
                        style={{ width: "100%", marginTop: 16 }}
                        disabled={!canSubmitJoin || loading}
                        onClick={handleSubmit}
                    >
                        {loading ? "Submitting..." : "Join Boat & Get Number"}
                    </button>
                </div>
            )}
        </div>
    );
}