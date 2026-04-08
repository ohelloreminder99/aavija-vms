# Agent Dashboard Architecture (Mobile)

The Agent dashboard is the growth-engine interface for Sales and Implementation partners.

## 1. Commission Balance Card
- **Value:** Shows `agent_commission_balance` from the `users` table.
- **Logic:** Derived from successful premise referrals or visitor sign-ups (linked via `referral_code`).
- **Progress Bar:** Compares balance against `payout_threshold_agent` (Governed by Admin settings).

## 2. Action Buttons (Logic Layer)
- **Request Payout:**
    - **Logic:** Opens a dialog allowing a choice between "Cash" and "Tokens".
    - **Constraint:** Blocked if `kyc_verified` is false (for cash) or balance is below threshold.
    - **Effect:** Creates a `payout_requests` row with status 'pending'. 
- **KYC Details:**
    - **Logic:** Self-service form to update UPI ID and PAN number.
    - **Effect:** Updates `agent_payout_upi` and `pan_number` in `users` table. Marks the profile for Admin review.

## 3. Payout History List
- **Source:** Queries `payout_requests` for the current user.
- **Status Badges:**
    - `PENDING`: Request received, funds frozen.
    - `PROCESSING`: Admin has acknowledged, payment in bank queue.
    - `PAID`: Transaction complete. Funds deducted from `agent_commission_balance`.
    - `REJECTED`: Admin denied request (usually due to KYC mismatch). Reason is displayed.

## 4. Referral Tracking
- **Link Display:** Shows the Agent's unique referral link/code.
- **Metric:** (Upcoming) Count of properties activated via this specific agent.
