import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
    listSpeciesAdmin,
    getSpeciesById,
    upsertSpecies,
    listFishTypes,
    listSpeciesCategories,
    listFishingEnvironments,
    listResultMethods,
    listTypicalOutcomes,
} from "@/admin/services/Sports/Fishing/species";

/* ============================================================================
   TYPES
   ========================================================================== */

type SpeciesRow = {
    id: number;
    name: string;
    fish_type: string | null;
    category: string | null;
    environment: string | null;
    result_method: string | null;
    outcome: string | null;
    is_active: boolean;
};

type LookupRow = {
    id: string;
    name: string;
};

type SpeciesFormState = {
    name: string;
    is_measure: boolean; // required by DB, not user-editable
    fish_type_id: string;
    species_category_id: string | null;
    fishing_environment_id: string;
    primary_result_method_id: string;
    typical_outcome_id: string;
    is_active: boolean;
};

/* ============================================================================
   COMPONENT
   ========================================================================== */

export default function FishingSpecies() {
    const [loading, setLoading] = useState(true);
    const [species, setSpecies] = useState<SpeciesRow[]>([]);
    const [fishTypeFilter, setFishTypeFilter] =
        useState<"All" | "Game Fish" | "Sport Fish" | "Shellfish">("All");
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
        {}
    );

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const defaultForm: SpeciesFormState = {
        name: "",
        is_measure: false,
        fish_type_id: "",
        species_category_id: null,
        fishing_environment_id: "",
        primary_result_method_id: "",
        typical_outcome_id: "",
        is_active: true,
    };

    const [form, setForm] = useState<SpeciesFormState>(defaultForm);

    const [fishTypes, setFishTypes] = useState<LookupRow[]>([]);
    const [categories, setCategories] = useState<LookupRow[]>([]);
    const [environments, setEnvironments] = useState<LookupRow[]>([]);
    const [resultMethods, setResultMethods] = useState<LookupRow[]>([]);
    const [outcomes, setOutcomes] = useState<LookupRow[]>([]);

    useEffect(() => {
        loadAll();
    }, []);

    async function loadAll() {
        setLoading(true);
        const [speciesRows, ft, sc, fe, rm, to] = await Promise.all([
            listSpeciesAdmin(),
            listFishTypes(),
            listSpeciesCategories(),
            listFishingEnvironments(),
            listResultMethods(),
            listTypicalOutcomes(),
        ]);

        setSpecies(speciesRows);
        setFishTypes(ft);
        setCategories(sc);
        setEnvironments(fe);
        setResultMethods(rm);
        setOutcomes(to);
        setLoading(false);
    }

    function resetForm() {
        setEditingId(null);
        setForm(defaultForm);
    }

    const filtered = species.filter((s) =>
        fishTypeFilter === "All" ? true : s.fish_type === fishTypeFilter
    );

    const grouped = filtered.reduce<Record<string, SpeciesRow[]>>((acc, s) => {
        const key = s.category ?? "Uncategorised";
        acc[key] = acc[key] || [];
        acc[key].push(s);
        return acc;
    }, {});

    function openAdd() {
        resetForm();
        setShowModal(true);
    }

    async function openEdit(id: number) {
        const data = await getSpeciesById(id);

        setEditingId(id);
        setForm({
            name: data.name,
            is_measure: data.is_measure, // must persist
            fish_type_id: data.fish_type_id,
            species_category_id: data.species_category_id,
            fishing_environment_id: data.fishing_environment_id,
            primary_result_method_id: data.primary_result_method_id,
            typical_outcome_id: data.typical_outcome_id,
            is_active: data.is_active,
        });

        setShowModal(true);
    }

    async function saveSpecies() {
        await upsertSpecies(form, editingId ?? undefined);

        // Strong recommendation: force full reload to avoid stale admin view reads
        window.location.reload();
    }

    return (
        <>
            <nav className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
                <Link to="/admin/settings">Settings</Link> /{" "}
                <Link to="/admin/settings/sports/fishing">Fishing</Link> /{" "}
                <span>Species</span>
            </nav>

            <h1>Species</h1>

            <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
                {["All", "Game Fish", "Sport Fish", "Shellfish"].map((t) => (
                    <button
                        key={t}
                        className={
                            fishTypeFilter === t
                                ? "btn btn--sm-primary"
                                : "btn btn--sm-secondary"
                        }
                        onClick={() =>
                            setFishTypeFilter(t as typeof fishTypeFilter)
                        }
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Showing active and inactive</span>
                <button className="btn btn--sm-primary" onClick={openAdd}>
                    + Add Species
                </button>
            </div>

            {!loading &&
                Object.entries(grouped).map(([category, rows]) => {
                    const isOpen = openCategories[category] ?? false;
                    return (
                        <section key={category} className="card">
                            <header
                                onClick={() =>
                                    setOpenCategories((p) => ({
                                        ...p,
                                        [category]: !isOpen,
                                    }))
                                }
                            >
                                <strong>{category}</strong>
                            </header>

                            {isOpen && (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Result</th>
                                            <th>Outcome</th>
                                            <th>Environment</th>
                                            <th>Status</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((s) => (
                                            <tr key={s.id}>
                                                <td>{s.name}</td>
                                                <td>{s.result_method}</td>
                                                <td>{s.outcome}</td>
                                                <td>{s.environment}</td>
                                                <td>
                                                    {s.is_active
                                                        ? "Active"
                                                        : "Inactive"}
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn--sm-primary"
                                                        onClick={() =>
                                                            openEdit(s.id)
                                                        }
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </section>
                    );
                })}

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <h3>
                            {editingId ? "Edit Species" : "Add Species"}
                        </h3>

                        <input
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                            placeholder="Name"
                        />

                        <select
                            value={form.fish_type_id}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    fish_type_id: e.target.value,
                                })
                            }
                        >
                            <option value="">Fish Type</option>
                            {fishTypes.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={form.species_category_id ?? ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    species_category_id:
                                        e.target.value || null,
                                })
                            }
                        >
                            <option value="">Category</option>
                            {categories.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={form.fishing_environment_id}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    fishing_environment_id: e.target.value,
                                })
                            }
                        >
                            <option value="">Environment</option>
                            {environments.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={form.primary_result_method_id}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    primary_result_method_id: e.target.value,
                                })
                            }
                        >
                            <option value="">Result Method</option>
                            {resultMethods.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={form.typical_outcome_id}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    typical_outcome_id: e.target.value,
                                })
                            }
                        >
                            <option value="">Typical Outcome</option>
                            {outcomes.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </select>

                        <label>
                            <input
                                type="checkbox"
                                checked={form.is_active}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        is_active: e.target.checked,
                                    })
                                }
                            />{" "}
                            Active
                        </label>

                        <div style={{ textAlign: "right" }}>
                            <button
                                className="btn btn--sm-secondary"
                                onClick={() => {
                                    setShowModal(false);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn--sm-primary"
                                onClick={saveSpecies}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
