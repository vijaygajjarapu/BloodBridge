# BloodBridge Socket.IO Real-Time Communication

## 1. Connection Architecture

The real-time layer operates over WebSockets via Socket.IO, attached directly to the Express HTTP server on port 5000.

### Handshake & Authentication
Clients authenticate during handshake by supplying their JWT access token:
```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: localStorage.getItem('bloodbridge_auth_token'),
  },
  transports: ['websocket', 'polling'],
});
```

The server validates the JWT payload against `JWT_SECRET`. Unauthorized or expired tokens fall back to unauthenticated public listeners.

---

## 2. Server-Controlled Rooms

Clients **cannot** join arbitrary rooms from client requests. Rooms are exclusively joined on the server upon token verification:

1. `user:<userId>`: Private channel for personal events (notifications, referral completions, profile updates).
2. `admin:operations`: Private channel restricted to authenticated users with `role: "admin"`.

---

## 3. Event Catalog

### Connection Lifecycle
| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `connection:ready` | Server → Client | `{ connected: boolean, socketId: string, authenticated: boolean, userId: string \| null }` | Emitted immediately upon connection handshake completion. |
| `connection:error` | Server → Client | `{ message: string, code: string }` | Emitted when connection verification encounters an error. |

### Referral & Donor Network Events
| Event Name | Channel | Payload | Description |
| :--- | :--- | :--- | :--- |
| `referral:completed` | `user:<referrerId>` | `{ referralCode: string, referredUserName: string }` | Emitted when a new donor finishes registration via referrer's code. |
| `donor:list:updated` | `user:<referrerId>` | `{ message: string }` | Signals frontend to invalidate and refetch `my-referrals` queries. |
| `donor:profile:updated` | `user:<userId>` | `{ donorId: string }` | Emitted when donor profile details or availability changes. |

### Notification Events
| Event Name | Channel | Payload | Description |
| :--- | :--- | :--- | :--- |
| `notification:new` | `user:<userId>` | `{ id: string, title: string, message: string, timestamp: string }` | Push notification dispatched to recipient in real time. |
| `notification:read` | `user:<userId>` | `{ notificationId?: string, all?: boolean }` | Synchronizes read state across multiple active tabs or devices. |

### Administrator Operations
| Event Name | Channel | Payload | Description |
| :--- | :--- | :--- | :--- |
| `admin:dashboard:updated` | `admin:operations` | `{ reason?: string, userId?: string, status?: string }` | Signals admin console to refresh live metrics. |
| `admin:record:updated` | `admin:operations` | `{ type: string, id: string }` | Notifies staff of moderation or status actions. |
