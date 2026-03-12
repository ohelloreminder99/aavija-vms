# Host Dashboard Architecture (Mobile)

The Host role in Aavija refers to Residents, Tenants, or Employees within a Premise who receive visitors.

## 1. Unified Dashboard Experience
- **Logic:** In the current Mobile phase, the Host experience is integrated with the Visitor dashboard.
- **Role Detection:** The app detects `premise_roles` in the user's profile JSON. If 'host' is present for a specific premise, additional features are enabled.

## 2. Real-time Notifications (Alerts)
- **Component:** `NotificationService`.
- **Logic:** When a Gatekeeper scans a visitor and selects a Host, a real-time event is triggered (matching the `host_id` in the `visits` table).
- **Manual Action:** (Web-parity) The host receives a push notification and can view details of the incoming visitor.

## 3. Visitor Pre-authorization
- **Logic:** (Upcoming) Allowing Hosts to generate "Pre-approved" QR links to send to their expected guests via WhatsApp.
- **Effect:** Reduces gate congestion as the Gatekeeper only needs to scan the code rather than manually typing guest details.

## 4. History
- **Personal Log:** Shows a list of visitors who have visited *them* specifically, allowing for quick verification of previous arrivals.

---
**Note:** The mobile Host dashboard is designed to be lean, focusing on "Arrival Alerts" while deferring heavy management to the Owner dashboard.
