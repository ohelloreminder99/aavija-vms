# Step-by-Step Authentication Setup Guide

Follow these steps to ensure your production domains (`aavija.com`, `india.aavija.com`) correctly handle Google and Email/Password logins.

## Phase 1: Supabase Configuration

### 1. Enabling Automatic Identity Linking
This allows Google users to login with a password once they set one.
1. Go to your **Supabase Dashboard**.
2. Click the **Settings (Gear Icon)** at the bottom of the far-left sidebar.
3. Click **Auth** (under the "Configuration" section).
4. Scroll down to **User Management**.
5. Find **Link identities with the same email** and switch it to **ON**.
    - *Why?*: As per the documentation you found, this enables "Automatic Linking" which merges your Google account and Password account into one.
6. Click **Save**.

### 2. Email Provider Settings (From your image)
In your screenshot, **Confirm email** is currently **ON**.
- **Recommendation**: Keep this **ON** for security, as you suggested.
- **Why this is safe for your issue?**: Since your users sign up via **Google**, Supabase automatically marks their email as "Verified" (because Google verified it). 
- **The actual fix**: The most important setting is **Link identities with the same email** (Step 1 above). Once that is **ON**, Supabase will merge the Google login and Password login for the same email address automatically.
- **The secondary fix**: Ensure **Enable Email provider** is **ON**.

---

## Phase 2: Cloudflare Turnstile Configuration

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. On the left sidebar, click **Turnstile**.
3. Select your **Site Key**.
4. Click **Settings** for that Site Key.
5. In **Domain Management**, ensure these are added:
    - `localhost`
    - `aavija.com`
    - `india.aavija.com`
6. Click **Update** or **Save**.

---

## Phase 3: Final Test

1. Sign in with **Google** at `https://india.aavija.com/login`.
2. Go to **Settings -> Security Settings (Change Password)**.
3. Set a password.
4. **Log out**.
5. Log back in using your **Email** and the **New Password**.
6. **Success**: You should be in the same dashboard as before.
