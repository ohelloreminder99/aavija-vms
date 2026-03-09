# **App Name**: Aavija

## Core Features:

- Role-Based Dashboard: Provide role-specific dashboards with visibility into visitor history and average star ratings. Admins and staff can view visitor history based on configurable settings and city restrictions, while visitors can see their global average star rating.
- Secure Check-in Workflow: Implement a check-in process using rotating QR codes and dual-deduction (visitor and owner) of credits upon 'Confirm Check-in.' Lock visitors from new check-ins until checked out, with admin/owner ability to 'Force Check-out'.
- Communication and Trust Logic: Allow hosts to rate visitors with the latest rating overwriting previous ratings. Implement streamlined blocking of visitors. Trigger low token warnings when balances fall below a threshold, and enable admin announcements by role/city.
- Authentication and Onboarding: Enable persistent phone number verification using OTP to secure QR code generation. Utilize virtual email mapping for host authentication and provide admin tools for cleaning up orphaned accounts. Thresholds are configurable by the administrator.
- Visitor Image Analysis: Use a generative AI tool to analyze the visitor's profile photo for security or verification purposes.
- Blocking Reasoning (AI Assisted): Give hosts the option to provide free-form reasoning for why they blocked a guest. Use an AI tool to summarize this input into shorter text, to share with administrators in an effort to highlight issues, concerns, or potential violations of policy. Use an LLM-based tool which decides when or whether to share this new, shorter note with administrators.
- Firestore Integration with Repository Pattern: Decouple the UI from Firestore using a strict Repository Layer to ensure database portability. Store visit snapshots, visitor images and vehicle details with permanent URLs for audit.
- Frontend Architecture: Component-based Card Style Layout. Designed as a PWA (Progressive Web App) for mobile responsiveness.
- Abstraction Layer: Repository Pattern implemented in the service layer. UI components interact with interfaces like IVisitorRepository, making the app database-agnostic.
- Security: Firebase App Check enabled to prevent unauthorized API calls.
- Firestore Database Schema: Flat Structure: Since we are using a top-level flat architecture for portability, all collections are at the root.
- Firebase Security Rules: Snippet: Implement security rules for Firestore to control access to data based on user roles and permissions.
- Key Logic & Workflows: Describe the key logic and workflows of the application, including QR security, host login, and deduction mechanisms.

## Style Guidelines:

- Primary color: Dark blue (#30475E) to convey security and trust. It provides a professional and stable feel, crucial for a visitor management system.
- Background color: Light gray (#D6D5A8), desaturated to about 20% to create a subtle, neutral backdrop that doesn't distract from the main content.
- Accent color: Orange (#F05454), chosen for its high contrast against the dark blue. It draws attention to important actions and alerts.
- Body: 'Inter', a grotesque-style sans-serif font with a modern and neutral look; suitable for body text.
- Headlines: 'Space Grotesk', a proportional sans-serif with a techy, scientific feel. Used for headings.
- Code font: 'Source Code Pro' for displaying code snippets.
- Use consistent and clear icons to represent different actions and statuses (e.g., check-in, check-out, blocked). Icons should be simple, geometric, and easily recognizable. Use icons related to security such as shields, locks, and keys.
- Component-based rendering to maintain a modular and scalable UI. Employ scrollable long forms and DD/MM/YYYY date formats for data input. Use eye icons for password visibility.
- Subtle transitions and animations to provide feedback on user interactions (e.g., button clicks, form submissions). Animations should be used sparingly to avoid distracting the user.