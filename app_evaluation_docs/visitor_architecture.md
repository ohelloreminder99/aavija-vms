# Visitor Dashboard Architecture (Mobile)

The Visitor dashboard is the primary interface for the "Customer" role in the Aavija ecosystem. It focuses on mobility, entry passes, and personal ledger tracking.

## 1. Header & Identity
- **Greeting Component:** Displays the user's name fetched from the `users` table.
- **Refresh Indicator:** Manual pull-to-refresh that invalidates the `userProfileProvider` and re-fetches visit history.

## 2. Token Balance Card (Logic Layer)
- **VTK Display:** Shows `token_balance_visitor` from the Supabase `users` table.
- **Top Up Button:** (Placeholder) Intended for payment gateway integration (Vite-parity feature).
- **Effect:** Any token purchase increases `token_balance_visitor`. Tokens are deducted upon visiting paid premises or performing premium actions.

## 3. Dynamic Entry/Pass Component (State Based)
This component switches based on `active_checkin_id`:

### A. If NOT Checked-in: "Generate QR" Card
- **Component:** `ready_to_visit` prompt.
- **Logic:** Navigates to `/scanner/passport` which generates a time-gated JWT/Token for the Gatekeeper to scan.

### B. If Checked-in: "Active Pass" Card
- **Logic:** Detects `active_checkin_id` is NOT null.
- **UI:** Replaces "Check Out" button with instructions: *"Present your QR code at the exit to check-out securely."*
- **Reasoning:** Enforces professional security verification at exit points.

## 4. Quick Actions Grid
- **Profile:** Link to `UpdateableUserProfile` fields (Name, Phone, City).
- **Vehicles:** Manages user's vehicle list (Synced to `users.vehicles` JSONB). Essential for gatekeeper verification of vehicle numbers.
- **History:** List of all previous visits (Filtered by `visitor_id`).
- **Ledger:** Detailed view of token transactions (In/Out).

## 5. Recent Activity List
- **Logic:** Queries the `visits` table joined with `premises`.
- **UI:** Shows Premise Name, Status (Active/Completed), and formatted Check-in time.
