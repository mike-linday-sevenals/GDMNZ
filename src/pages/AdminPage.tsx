import React from 'react';
import AdminGate from '../components/AdminGate';

export default function AdminPage() {
  return (
    <AdminGate>
      <main style={{ padding: '24px' }}>
        <h1>GDMNZ — Admin</h1>
        <p>Welcome to the admin side. (This content is covered by the gate until unlocked.)</p>

        {/* Your existing admin UI goes here */}
        <section style={{ marginTop: 20 }}>
          <ul>
            <li>Manage events</li>
            <li>Enter results</li>
            <li>Update sponsors</li>
          </ul>
        </section>
      </main>
    </AdminGate>
  );
}
