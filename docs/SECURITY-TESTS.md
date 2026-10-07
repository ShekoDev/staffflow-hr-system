# Security verification

The authorization model was executed against a real PostgreSQL 16 instance with a
stand-in for Supabase's `auth` schema (`auth.users`, `auth.uid()`, the
`authenticated` role and the same grants Supabase applies). All nine migrations
were applied to an empty database, then each case below was run as a specific
signed-in user by setting the JWT subject.

Two real vulnerabilities were found this way and fixed before delivery — they are
listed at the bottom.

## Fixtures

| User | Role | Notes |
|------|------|-------|
| `admin@acme.com` | Admin | promoted by `bootstrap_first_admin` |
| `hr@acme.com` | HR | company-wide view, no user management |
| `manager@acme.com` | Manager | line manager of the employee below, and manager of the Operations department |
| `employee@acme.com` | Employee | reports to the manager |
| `other@acme.com` | Employee | same department, different reporting line |
| `EMP-0009` | (no account) | Sales department — genuinely outside the manager's scope |

## Results

### Identity and privilege

| # | Case | Expected | Result |
|---|------|----------|--------|
| A | Sign-up asks for `role_key: admin` in its metadata | ignored — account created as inactive employee | ✅ `employee` / `is_active = false` |
| B | `bootstrap_first_admin('admin@acme.com')` | promotes the first account only | ✅ promoted; refuses to run again |
| C | Employee runs `UPDATE users SET role_id = <admin>` on their own row | blocked | ✅ `42501` from the privilege trigger |
| D | HR tries the same escalation | blocked | ✅ blocked — `users.manage` required |
| E | Employee updates their own theme and colour mode | allowed | ✅ updated |
| F | Account deactivated, then queries | sees nothing at all | ✅ 0 employees, 0 permissions |

### Row visibility

| # | Case | Expected | Result |
|---|------|----------|--------|
| G | Employee selects all employees | only self + own manager | ✅ 2 rows |
| H | Manager selects all employees | own reporting line and own department only | ✅ 4 rows; the Sales employee is not among them |
| I | Manager calls `is_manager_of()` on a Sales employee | false | ✅ false (true for their own department) |
| J | Employee runs `INSERT INTO employees` directly | blocked | ✅ blocked by RLS |
| K | Manager selects attendance | own team only | ✅ colleague's rows not returned |

### Permissions

| # | Case | Expected | Result |
|---|------|----------|--------|
| L | Explicit *deny* on `ranking.view` for a user whose role grants it | deny wins | ✅ permission gone |
| M | Explicit *allow* on `employees.view_all` for an employee | permission added | ✅ full list visible |
| N | Employee calls `compute_monthly_ranking()` | blocked | ✅ `insufficient_privilege` |

### Workflows

| # | Case | Expected | Result |
|---|------|----------|--------|
| O | Manager takes the register for their own report | allowed | ✅ written |
| P | Manager writes attendance for a Sales employee | blocked | ✅ blocked |
| Q | HR writes attendance company-wide | allowed (`attendance.manage`) | ✅ written |
| R | Manager evaluates their own report | allowed | ✅ saved |
| S | Employee evaluates a colleague | blocked | ✅ blocked |
| T | Employee submits their own self assessment | allowed | ✅ saved |
| U | Manager is notified that a self assessment is waiting | notification raised | ✅ 1 notification |
| V | Admin approves an evaluation | employee notified | ✅ approval notification raised |
| W | Late arrival recorded | employee notified | ✅ notification raised |
| X | Leave approved by the manager | employee notified | ✅ "Your leave request was approved" |
| Y | `compute_monthly_ranking()` run by an admin | ranks everyone, flags and badges the winner | ✅ 5 ranked, Employee-of-the-Month badge auto-awarded |
| Z | Audit entry written through `log_audit` | actor recorded | ✅ actor name, action and target stored |

Cases C–K and P–S are the ones that matter most: they are executed as raw SQL,
bypassing the interface entirely. This is what "enforced at the database level,
not hidden in the frontend" means in practice — the same result would come back
from a hand-crafted REST call carrying a stolen anon key.

## Issues found and fixed

**1. Privilege escalation through the self-update policy.**
`users_update_self` allowed a user to update their own row so they could change
their language and theme. Nothing stopped them from updating `role_id` in the
same statement, and an employee could make themselves an administrator.
*Fix:* the `protect_user_privileges` trigger (migration 0005) rejects any change
to `role_id`, `is_active`, `must_change_password` or `id` unless the caller holds
`users.manage`. Preference columns are unaffected.

**2. Role injection at sign-up.**
`handle_new_auth_user` read the requested role out of the sign-up metadata. The
anon key is public, so anyone could sign up asking for `role_key: admin`.
*Fix:* the trigger now ignores metadata entirely — every new account is created
as an **inactive employee**. The administrator's provisioning flow activates the
account and assigns the role in a second step, which runs under their session and
is gated by `users.manage`.

## A note on manager scope

An early run appeared to show a manager writing attendance outside their team.
It was the test that was wrong, not the policy: that manager was also the
Operations *department* manager, so the employee was legitimately inside their
scope. Re-tested against an employee in another department, both the read and the
write were blocked (cases H, I and P). Management scope is deliberately three
things at once — the line-manager chain at any depth, the department manager, and
the manager of a team the employee belongs to.

## Reproducing

Start any PostgreSQL 16, create the `auth` stub, apply
`supabase/migrations/*.sql` in order, then run the cases as
`SET ROLE authenticated; SET request.jwt.claim.sub = '<user-uuid>';`.
