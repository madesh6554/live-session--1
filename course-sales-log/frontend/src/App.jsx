import { Routes, Route, Navigate } from 'react-router-dom';
import Entry from './pages/Entry';
import Dashboard from './pages/Dashboard';

/**
 * Two URLs, no sign-in:
 *   /entry     — the fast entry form, all a salesperson ever sees
 *   /dashboard — KPIs, charts and the full sales log
 */
export default function App() {
  return (
    <Routes>
      <Route path="/entry" element={<Entry />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/entry" replace />} />
    </Routes>
  );
}
