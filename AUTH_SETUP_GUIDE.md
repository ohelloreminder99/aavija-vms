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

## Phase 3: Vercel Environment Variables

Based on your screenshot, these two essential keys are missing from your Vercel project. Without them, the WhatsApp API cannot be called.

1.  Open your [Vercel Dashboard](https://vercel.com/dashboard).
2.  Select your Project (**Aavija**).
3.  Click on the **Settings** tab at the top.
4.  Click on **Environment Variables** in the left sidebar.
5.  **Add the First Variable**:
    - **Key**: `WHATSAPP_PHONE_NUMBER_ID`
    - **Value**: (Copy the ID from your Meta Developer Portal)
    - Ensure **Production**, **Preview**, and **Development** are checked.
    - Click **Save**.
6.  **Add the Second Variable**:
    - **Key**: `WHATSAPP_ACCESS_TOKEN`
    - **Value**: (Copy your Permanent System User Token from Meta)
    - Ensure **Production**, **Preview**, and **Development** are checked.
    - Click **Save**.

### ⚠️ IMPORTANT: RE-DEPLOY REQUIRED
Vercel environment variables do **not** take effect immediately on a running site.
1.  After adding the keys, go to the **Deployments** tab in Vercel.
2.  Find your latest deployment (it should be at the top).
3.  Click the three dots `...` and select **Redeploy**.
4.  Once the new deployment is "Ready", the WhatsApp OTPs will start working.

---

## Phase 4: Final Verification

1. Sign in with **Google** at `https://india.aavija.com/login`.
2. Go to **Settings -> Security Settings (Change Password)**.
3. Set a password.
4. **Log out**.
5. Log back in using your **Email** and the **New Password**.
6. **Success**: You should be in the same dashboard as before.
