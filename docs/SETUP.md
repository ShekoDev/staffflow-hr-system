# StaffFlow — Employee Management & HR System

React + TypeScript + Tailwind on the front end, Supabase (PostgreSQL + Auth + Row Level Security) on the back end, deployed to Cloudflare Pages.

**All nine phases are built.** Employees, attendance, leaves, evaluations, monthly ranking, reports with PDF and Excel export, themes, frames, badges, name colours, notifications and the audit log are all working and permission-aware.

---

## 1. Set up Supabase (10 minutes)

1. Create a free project at [supabase.com](https://supabase.com). Pick a region close to Saudi Arabia (`eu-central-1` is a good default).
2. Open **SQL Editor** and run the files in `supabase/migrations/` **in order**:

   | # | File | What it creates |
   |---|------|-----------------|
   | 1 | `0001_schema_core.sql` | roles, permissions, users, departments, employees, teams |
   | 2 | `0002_schema_attendance.sql` | attendance, leave types, leave requests, holidays |
   | 3 | `0003_schema_evaluations.sql` | templates, dynamic criteria, stage weights, evaluations, rankings |
   | 4 | `0004_schema_customization.sql` | frames, badges, name-colour rules, themes, notifications, audit log, settings |
   | 5 | `0005_functions_triggers.sql` | permission engine, management-scope resolution, privilege guard, ranking calculation |
   | 6 | `0006_rls_policies.sql` | Row Level Security on every table |
   | 7 | `0007_seed_reference_data.sql` | 4 roles, 40 permissions, 6 themes, 9 frames, 7 badges, default evaluation template |
   | 8 | `0008_bootstrap.sql` | one-time first-administrator promotion |
   | 9 | `0009_notifications.sql` | notification triggers and automatic Employee-of-the-Month badge |

   Paste each file, press **Run**, confirm success, then move to the next.

3. **Authentication → Providers → Email**: turn **Confirm email** off while you set things up (otherwise every new account needs to click a link before it can sign in).

4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

### Create the first administrator

StaffFlow has no public sign-up screen by design. Create the first account in Supabase under **Authentication → Users → Add user** (tick *Auto Confirm User*), then run this once in the SQL Editor:

```sql
select public.bootstrap_first_admin('you@yourcompany.com');
```

It promotes that account to administrator and creates its employee record. It refuses to run again once an administrator exists, so it cannot be used to escalate privileges later.

From then on every other user is created from inside the app: **Employees → New Employee → Create a login account**.

---

## 2. Run it locally

```bash
npm install
cp .env.example .env      # then paste your Supabase URL and anon key
npm run dev               # http://localhost:5173
```

Other scripts:

```bash
npm run typecheck         # TypeScript, no emit
npm run build             # production build into dist/
npm run preview           # serve the production build
```

---

## 3. Deploy to Cloudflare Pages

1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. **Settings → Environment variables**, for both Production and Preview:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.

Every push to your production branch rebuilds and republishes to the **same URL**, so the link you give your staff never changes. `public/_redirects` is already in place so deep links like `/employees/123` work on refresh.

> The anon key is meant to be public — it is in every browser that loads the app. What protects your data is Row Level Security, not the key.

---

## 4. What the system does

### Employees & organization
Employee records with photo, bilingual names, contact details, job title, department, manager, gender, joining date and status. Departments with their own manager and headcount, teams with members, and a reporting tree that shows who reports to whom.

### Attendance
A daily register where you set a status for everyone at once (present, absent, late, leave, holiday, excused, early leave), with check-in and check-out times. Entering a check-in applies your work-start rule automatically and marks the day late when it falls past the grace period. There is a monthly calendar per employee, an absence view over any date range, and leave requests with an approval flow.

### Evaluations
Criteria live in the database — add, weight, reorder, deactivate — across four stages: manager, administrative, self and peer. Each stage has its own contribution to the final score, editable from Evaluation Settings. Managers score their own team; employees complete a self assessment when it is enabled; the final score blends the stages by their weights and renormalises when a stage is missing.

### Ranking
`compute_monthly_ranking()` blends attendance, punctuality and approved evaluations using the weights in System Settings, ranks everyone, flags Employee of the Month, awards the badge and notifies the winner.

### Reports & export
Attendance, employee and evaluation reports, filtered by employee, department, team, manager, gender, date range and status — all combinable. Export to **PDF** (branded header, meta block, table, summary statistics, copyright footer, page numbers) or **Excel** (styled header, auto-filter, sized columns, summary section).

The Arabic in PDFs is real shaped Arabic: `src/lib/pdf/arabic.ts` joins the letters into their contextual forms, applies lam-alef ligatures and reorders right-to-left runs, because PDF viewers do none of that themselves. Arabic workbooks open right-to-left in Excel.

### Customization
Themes, profile frames, badges and name-colour rules are all editable rows with live previews. Priority decides which rule wins when several match — Employee of the Month outranks a role, for example.

### Notifications & audit
Database triggers raise notifications on recorded absences and late arrivals, approved evaluations, self assessments waiting for a manager, leave decisions and ranking publication. The audit log records who did what, to which record, and when.

---

## 5. How security works

Authorization is enforced in the database, not in the interface. Hiding a button is a convenience; the policy is the rule.

- **Role + permission**, not role alone. Four seeded roles (Admin, HR, Manager, Employee) each map to a set of the 40 permission keys, all editable from **Users & Permissions**.
- **Per-user overrides** sit on top of the role: *inherit*, *allow*, or *deny*. An explicit deny always beats a role grant.
- **Management scope** is resolved recursively — the line-manager chain (any depth), the department manager, and the manager of a team the employee belongs to.
- **An employee sees only their own record and their own manager.** Not through hidden UI — the `SELECT` policy returns nothing else, so a hand-crafted API call returns nothing else either.
- **Deactivating an account blinds it immediately.** Every policy is gated on `current_user_active()`.
- **Privilege columns are trigger-protected.** Users may edit their own language, theme and colour mode; changing `role_id` or `is_active` requires `users.manage`.
- **Sign-up metadata is ignored.** New accounts are always created as *inactive employees* regardless of what the sign-up request asks for; an administrator activates them and assigns the role.

These behaviours are verified against a live PostgreSQL instance — see `docs/SECURITY-TESTS.md` for the cases and results, including two real vulnerabilities that testing caught and that are now fixed.

---

## 6. Project structure

```
src/
├── components/
│   ├── ui/           Button, Field, Card, Modal, Table, Badge, Tabs, …
│   ├── layout/       AppLayout, Sidebar, Topbar
│   └── common/       EmployeeIdentity, StatCard, FilterBar, PermissionGate
├── features/         one folder per module (auth, attendance, evaluations, reports, …)
├── services/         every Supabase call lives here — components never query directly
├── providers/        Auth, Theme, Settings, Toast, i18n composition
├── hooks/            react-query wrappers and small utilities
├── i18n/             translation system + en / ar dictionaries
├── lib/              env, supabase client, permissions, appearance rules, formatting
│   └── pdf/          Arabic shaper, embedded font, report renderer
├── routes/           route table and permission-aware navigation
├── types/            domain models mirroring the database
└── styles/           design tokens and base styles
```

The separation is deliberate: UI never talks to Supabase, services never render, and business rules (permissions, appearance resolution, score maths) live in `lib/` and `services/` where both can use them.

---

## 7. What the admin controls without touching code

| Area | Where |
|------|-------|
| Company name, logo, system name | Settings → Branding |
| PDF footer and accent colour | Settings → PDF Branding |
| Default theme, colour mode, language | Settings → Appearance |
| Work hours, grace period, work days | `attendance_rules` in System Settings |
| Ranking weights | `ranking_weights` in System Settings |
| Splash screen: on/off, duration, image or video | Settings → Splash Screen |
| Role permissions | Users & Permissions → Role Permissions |
| Per-user overrides | Users & Permissions → Users → Overrides |
| Departments, teams, managers | Employees → Departments / Teams |
| Evaluation criteria and weights | Evaluations → Criteria / Settings |
| Themes, frames, badges, name colours | Customization → each tab |

### Replacing the splash screen

Settings → Splash Screen → set **Media type** to `image` or `video` and paste the URL. The layout, animation and copyright line stay as they are; only the centre slot changes. No code edit needed.

---

## 8. Themes and language

Six themes ship in the `themes` table — Modern Blue, Professional, Glassmorphism, Minimal, Corporate, Soft/Elegant — each with a full light and dark token map. They are stored as data, so adding a seventh is an `INSERT` or a few clicks in Customization → Themes.

Language is a real translation system: `src/i18n/locales/en.ts` and `ar.ts`. TypeScript enforces that both files carry the same keys, so a missing Arabic string is a build error, not a blank label at runtime. Arabic switches the whole document to RTL.

Both preferences persist per user in their `users` row and fall back to the administrator's defaults.

---

## 9. Extending it

The parts that make the next feature cheap:

- **Add a permission** — insert a row in `permissions`, grant it in `role_permissions`, add the key to `src/lib/permissions.ts`. The nav, the route guards and the `can()` helper pick it up.
- **Add a screen** — a folder under `features/`, a route in `routes/index.tsx`, an entry in `routes/navigation.ts` with the permissions that reveal it.
- **Add a table** — a migration with its RLS policies, a service module, a typed model in `types/models.ts`.
- **Payroll, requests, tasks, KPIs, recruitment, contracts** — none of these need the existing schema changed; they hang off `employees` the way attendance and evaluations already do.

---

جميع حقوق الملكية محفوظة لمحمود شهاب
