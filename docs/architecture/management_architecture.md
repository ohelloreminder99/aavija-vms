# Owner & Admin Dashboard Architecture (Mobile)

Documentation for high-authority roles managing Premises and the Aavija Ecosystem.

---

## 🏛️ Owner Dashboard
Focuses on the performance and security of a specific Property/Premise.

### 1. Real-time Analytics Grid
- **Total Visits:** Count of rows in `visits` where `premise_id` matches.
- **Total Hosts:** Count of users joined to this premise with the 'host' role.
- **Gatekeepers:** Active security staff assigned.
- **Variable Logic:** These numbers are live indicators. High visit counts/low host counts might signal the need for more staff.

### 2. Premise Token Balance
- **VTK Balance:** Specific to the Property. Used to pay for gatekeeper services or premium features.
- **Effect:** If balance hits zero, certain high-logic features (like automatic reports) might pause.

### 3. Management Tiles
- **Hosts/Staff Management:** Add/Remove users from the premise profile.
- **Blocked Visitors:** View and manage the premise-specific blacklist (`premise_blocked_visitors` table).

---

## 🛡️ Admin Dashboard (Governance)
Focuses on system health, financial reconciliation, and global settings.

### 1. Variables & Global Effects

| Variable (Database Column) | Dashboard Component | System-Wide Effect |
| :--- | :--- | :--- |
| `tds_enabled` | Bills & GST / Settings | If true, applies tax deduction to all cash-out requests. |
| `tds_rate` | Settings | Determines the exact % withheld from Agent payouts. |
| `token_conversion_rate` | Token Logic | Defines the exchange rate (e.g., 100 VTK = ₹1). Affects Agent earnings. |
| `payout_threshold_agent`| Sales Agents | Minimum income required before an agent can request a withdrawal. |
| `maintenance_mode` | (Global Control) | If true, redirects all users to a "Coming Soon" screen. |

### 2. Core Modules
- **Sales Agents:** Overview of all `is_agent=true` users. Admin can manually verify KYC documents uploaded by agents.
- **Audit Logs:** Full system transparency (Who added this property? Who processed this payout?).
- **Bill & GST:** Financial hub. Variables here track GST compliance across all premise transactions.
- **Token Logic:** Adjusting the "economy" of the app (Prices, conversion rates, referral rewards).
- **Locations:** Managing the "City/State" database (Affects filtering during premise creation).

## 3. Basic Security Components
- **Auth Cleanup:** Tool to remove dead/unverified accounts to save database space.
- **Change Password:** Standard security for the Admin account.
