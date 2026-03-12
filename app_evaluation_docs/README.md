# App Evaluation & Logic Documentation

This directory contains a complete breakdown of the Aavija Mobile application's role-based architectures. Use these files to verify feature parity with the web platform and understand the underlying database interactions.

## Document Directory
1. **[Visitor Architecture](visitor_architecture.md)**: Entry passes, token balances, and checkout flows.
2. **[Gatekeeper Architecture](gatekeeper_architecture.md)**: QR scanning, identity verification, and host linking.
3. **[Management Architecture (Owner/Admin)](management_architecture.md)**: 
    - **Owner:** Premise analytics and staff oversight.
    - **Admin:** Global system governance, GST logic, and variable-to-outcome mapping.
4. **[Agent Architecture](agent_architecture.md)**: Commissions, KYC, and payout workflows.

## Critical Variable Mapping (Example: Admin Console)
If you change a variable in the **Admin Console**, here is where the effect is felt:

- **Variable:** `token_conversion_rate`
  - **Where it changes:** Admin Dashboard -> Token Logic.
  - **Where it matters:** Agent Dashboard -> "Request Payout" calculation.
  
- **Variable:** `kyc_verified`
  - **Where it changes:** Admin Dashboard -> Sales Agents -> Verify.
  - **Where it matters:** Agent Dashboard -> Enables "Cash" payout request button.

- **Variable:** `active_checkin_id`
  - **Where it changes:** Gatekeeper scans Visitor QR code.
  - **Where it matters:** Visitor Dashboard -> Displays "Active Pass" instead of "Generate QR".

---
**Verification Prepared by Antigravity (Phase 11 Completion Audit)**
