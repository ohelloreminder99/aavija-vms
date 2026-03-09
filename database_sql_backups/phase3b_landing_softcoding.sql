-- Phase 3B: Landing Page Softcoding
-- Adds fields to the settings table to allow admin control over the homepage content.

ALTER TABLE settings ADD COLUMN IF NOT EXISTS landing_hero_title TEXT DEFAULT 'Simple, Safe & Secure Access.';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS landing_hero_subtitle TEXT DEFAULT 'Eliminate paper logs. Aavija provides a seamless, smart way to manage visitors, owners, and staff with real-time verification and military-grade security.';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS landing_cta_primary TEXT DEFAULT 'Setup Your Premise Free';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS landing_cta_secondary TEXT DEFAULT 'Watch Product Tour';

-- Add a JSONB column for dynamic features if we want to go full-Jobs mode
ALTER TABLE settings ADD COLUMN IF NOT EXISTS landing_features JSONB DEFAULT '[
  {"title": "Seamless Check-in", "description": "Visitors generate a secure QR code for instant, paperless entry. Gatekeepers scan and verify in seconds.", "icon": "QrCode"},
  {"title": "WhatsApp Notifications", "description": "Hosts are immediately notified via WhatsApp the moment their visitor arrives at the gate.", "icon": "MessageSquareText"},
  {"title": "Sovereign Security", "description": "Military-grade encryption and regional data proxying ensure your records are always safe and accessible.", "icon": "ShieldCheck"},
  {"title": "Token Economy", "description": "A fair, integrated token system simplifies billing for premises and provides value for visitors.", "icon": "Coins"},
  {"title": "Role-Based Dashboard", "description": "Tailored experiences for Owners, Hosts, Staff, and Visitors in one unified ecosystem.", "icon": "LayoutDashboard"},
  {"title": "Audit-Ready Logs", "description": "Searchable digital history replaces messy registers for complete transparency.", "icon": "ClipboardCheck"}
]';

-- Log the migration
INSERT INTO logs (action, description, "actorRole")
VALUES ('SYSTEM_MIGRATION', 'Added landing page softcoding fields to settings table.', 'admin');
