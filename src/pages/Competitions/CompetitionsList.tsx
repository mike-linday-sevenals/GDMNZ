import { useEffect, useState } from 'react';
import { listCompetitions } from '@/services/api';
import AddCompetition from './AddCompetition';
import { Link } from 'react-router-dom';

export default function CompetitionsList() {
    const [competitions, setCompetitions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);

    useEffect(() => {
        load();
    }, []);

    async function load() {
        setLoading(true);
        try {
            const data = await listCompetitions();
            setCompetitions(data || []);
        } catch (err) {
            console.error(err);
            alert('Failed to load competitions');
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="card admin-card" style={{ padding: 24 }}>
            <h2>Competitions</h2>

            <div className="actions" style={{ marginBottom: 16 }}>
                <button className="btn primary" onClick={() => setShowAdd(true)}>
                    + Add Competition
                </button>
            </div>

            {showAdd && (
                <AddCompetition
                    onClose={() => {
                        setShowAdd(false);
                        load();
                    }}
                />
            )}

            {loading ? (
                <p className="muted">Loading…</p>
            ) : competitions.length === 0 ? (
                <p className="muted">No competitions found.</p>
            ) : (
                <table className="data-table" style={{ width: '100%', marginTop: 12 }}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Starts</th>
                            <th>Ends</th>
                            <th style={{ width: 120 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {competitions.map((comp) => (
                            <tr key={comp.id}>
                                <td>{comp.name}</td>
                                <td>{comp.starts_at}</td>
                                <td>{comp.ends_at}</td>
                                <td>
                                    <Link
                                        to={`/admin/competitions/${comp.id}`}
                                        className="btn--sm-primary"
                                    >
                                        Edit
                                    </Link>



                                </td>

                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
