# BloodBridge Performance Optimization Guide

## 1. Frontend Bundle Optimization

The production frontend bundle is compiled using Vite 8 and Rolldown with customized chunk splitting.

### Optimization Results
- **Vendor Chunk Splitting:**
  - `vendor-react.js`: `352 kB` (React 19, React Router v7)
  - `vendor-charts.js`: `384 kB` (Recharts isolated so charts do not bloat landing or onboarding)
  - `index.js`: `369 kB` (Application logic)
  - CSS: `41 kB` (Tailwind CSS purged of all unused utility classes)
- **Zero Chunk Warnings:** Eliminated the 500 kB build warning. Build completed in **6.33 seconds** (65% improvement over initial 18.15s).
- **Gzip Footprint:** Compressed over-the-wire payload is under **320 kB** total for initial load.

---

## 2. Database Query Performance

- **Selective Projection:** Endpoints explicitly select needed fields, avoiding `SELECT *` queries that transmit password hashes or unnecessary data.
- **Relational Indexes:**
  - Foreign keys (`referrerUserId`, `userId`, `recipientId`) are indexed to maintain $O(\log n)$ lookup performance.
  - Frequent filters (`bloodGroup`, `city`, `isAvailable`) feature dedicated B-tree indexes.
- **Server-Side Pagination:** All list endpoints (`/donors/my-referrals`, `/admin/users`, `/admin/donors`, `/admin/audit-logs`) enforce pagination via `skip` and `take`, avoiding unbounded memory consumption.

---

## 3. Real-Time Efficiency

- **Targeted Room Routing:** Events are emitted strictly to private user rooms (`user:<id>`), preventing client-side filtering overhead and extraneous network traffic.
- **Payload Minimization:** Socket payloads carry lightweight IDs and signal invalidation rather than massive serialized database trees.
- **Reconnection Handling:** Clients retain cache state via TanStack Query and reconcile on reconnection.
