import { useState } from 'react';
import { addCompetition } from '@/services/api';

export default function AddCompetition({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState('');
    const [startsAt, setStartsAt] = useState('');
    const [endsAt, setEndsAt] = useState('');
    const [saving, setSaving] = useState(false);

    async function save() {
        try {
            setSaving(true);
            await addCompetition({
                name,
                starts_at: startsAt,
                ends_at: endsAt,
            });
            onClose();
        } catch (err) {
            console.error(err);
            alert('Failed to add competition');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal card" style={{ padding: 24, width: 400 }}>
                <h3>Add Competition</h3>

                <div className="field">
                    <label>Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} />
                </div>

                <div className="field">
                    <label>Start date</label>
                    <input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
                </div>

                <div className="field">
                    <label>End date</label>
                    <input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
                </div>

                <div className="actions" style={{ marginTop: 20 }}>
                    <button className="btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn primary"
                        disabled={saving || !name || !startsAt || !endsAt}
                        onClick={save}
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
