# Security & Supabase RLS

## Principles

1. A team is the tenant boundary.
2. Every tenant-owned object reaches a team through a foreign-key chain.
3. Database RLS is authoritative.
4. Frontend role checks are UX only.
5. Service-role credentials are backend-only.
6. Membership is checked before project-room subscription.
7. Invitations do not grant access until accepted.

## Helper Functions

`is_team_member(team_id)` checks whether `auth.uid()` has a membership row.

`team_role(team_id)` returns the current authenticated user's role.

Both functions are `SECURITY DEFINER`, use a fixed `search_path`, and are owned by a trusted database owner to avoid recursive RLS evaluation.

## Policy Listing

The canonical executable policies are in `supabase/schema.sql`. The following summarizes the intended rules.

### teams

- SELECT: authenticated members may read their own team.
- UPDATE: owner/admin.
- DELETE: owner.
- INSERT: authenticated users may create a team, with the creator inserted as owner.

### team_members

- SELECT: team members may read membership.
- INSERT: owner/admin may add membership.
- UPDATE: owner/admin may change roles, subject to application-level owner-transfer rules.
- DELETE: owner/admin may remove members; owner cannot remove the final owner.

### invitations

- SELECT: owner/admin of the team or the invited authenticated user.
- INSERT: owner/admin.
- UPDATE: invited user may accept their invitation; owner/admin may revoke.

### projects

- SELECT: team member.
- INSERT: owner/admin/member.
- UPDATE: owner/admin/member.
- DELETE: owner/admin.

### labels

- SELECT: team member.
- INSERT/UPDATE: owner/admin/member.
- DELETE: owner/admin.

### tasks

- SELECT: team member of the project.
- INSERT: owner/admin/member.
- UPDATE: owner/admin/member.
- DELETE: owner/admin/member.
- Viewer has read-only access.

### task_labels

Access is inherited through the parent task's project/team membership.

### comments

- SELECT: team member of the task's project.
- INSERT: owner/admin/member.
- UPDATE: comment author or owner/admin.
- DELETE: comment author or owner/admin.

### notifications

- SELECT/UPDATE: only the notification recipient.
- INSERT: controlled server-side; users cannot create arbitrary notifications for other users through normal client access.

### activity_events

- SELECT: team member of the project.
- INSERT: controlled by trusted server/database flow.
- UPDATE/DELETE: disabled for normal users to preserve activity history.

## Rationale

RLS is intentionally expressed in terms of membership instead of user IDs copied into every row. This makes tenant isolation consistent and avoids relying on every API query to remember a filter. Role checks are placed in write policies so a viewer cannot bypass a disabled UI control by directly calling an API.

The service-role key bypasses RLS, so backend endpoints using it must explicitly enforce authorization. It is therefore treated like a database credential, never committed and never exposed in `VITE_*` variables.

## Operational Checklist

- Enable MFA for privileged production accounts.
- Rotate service-role credentials if exposure is suspected.
- Enable Supabase database backups.
- Review RLS policies after every schema change.
- Use HTTPS in production.
- Configure Sentry with an appropriate environment and release.
- Add rate limiting to authentication/invitation endpoints.
