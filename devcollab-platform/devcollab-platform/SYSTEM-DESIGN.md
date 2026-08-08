# DevCollab Platform — System Design RFC

## 1. Context and Goals

DevCollab is a multi-tenant collaboration platform for teams managing projects and work items. The system must keep tenant data isolated, expose role-aware project collaboration, support real-time project activity, and provide useful operational reporting. The design prioritizes security boundaries at the database layer rather than trusting only frontend checks.

The core goals are: (1) team-level tenancy, (2) role-based authorization, (3) task and sub-task management, (4) threaded collaboration, (5) searchable work history, (6) notifications, (7) real-time activity, (8) project reporting, and (9) deployable automated verification.

## 2. Architecture

The frontend is a Vite React single-page application. It owns presentation, client state, navigation, and the Supabase browser session. It communicates with the backend using bearer access tokens.

The backend is an Express API. Middleware validates the Supabase JWT and attaches the authenticated user ID to the request. Business operations are exposed through REST endpoints. The server uses a Supabase service-role client for controlled server-side operations, while database RLS remains the authoritative policy boundary for client-facing data access. Service-role access is never sent to the browser.

PostgreSQL is the system of record. Supabase Auth supplies identity. Socket.io provides a convenient WebSocket channel for project activity. The activity model is intentionally persisted in PostgreSQL first, so a reconnecting client can query history rather than relying solely on transient socket messages.

## 3. Tenant Model

A team is the tenant boundary. A user becomes a tenant member through `team_members`. Membership has one of four roles: owner, admin, member, or viewer.

Projects belong to teams. Tasks belong to projects and therefore inherit the project’s team boundary. Comments belong to tasks, notifications belong to users, and activity events belong to projects. This creates a straightforward authorization chain:

`auth.uid() -> team_members -> teams -> projects -> tasks/comments`.

The database policies use this chain to prevent cross-tenant reads and writes. The UI may hide buttons for unauthorized users, but that is not considered security.

## 4. RBAC

Owners can manage all team resources and membership. Admins can manage projects and team collaboration but cannot transfer ownership through ordinary project APIs. Members can create and update work items according to project membership. Viewers are read-oriented.

A key trade-off is using a small fixed role enum instead of a fully customizable permission matrix. This reduces policy complexity, makes audits easier, and satisfies the assignment’s four-role requirement. If the product later needs custom permissions, a permissions table can be introduced without changing the tenancy model.

## 5. Data Model

The principal tables are `teams`, `team_members`, `invitations`, `projects`, `labels`, `tasks`, `task_labels`, `comments`, `notifications`, and `activity_events`.

Tasks use a self-reference (`parent_task_id`) for sub-tasks. This avoids a second task table and allows arbitrary hierarchy while the application can restrict UI depth if desired. `completed_at` is stored separately from status so cycle-time reporting can calculate the interval from creation to completion without inferring timestamps from text.

Comments use `parent_comment_id`, enabling threaded discussions. Mentions are detected in the API and converted to notifications only for users who are actual team members. This avoids creating notifications for arbitrary emails or external identities.

## 6. Search

PostgreSQL full-text search is used instead of loading all tasks/comments into application memory. A generated `tsvector` column is maintained from task title/description and comment body. GIN indexes accelerate matching.

The trade-off is language-sensitive PostgreSQL search configuration versus a dedicated search engine. For the assignment scale, PostgreSQL is substantially simpler operationally and transactional consistency is strong. Elasticsearch/OpenSearch would become attractive if ranking, typo tolerance, synonyms, or very large document volumes become requirements.

## 7. Realtime Activity

When a task/comment/project event is created, the backend emits an activity event through Socket.io to the project room. The persisted `activity_events` row is the durable record. Clients join a project room only after the server has verified team membership.

The design deliberately avoids trusting a client-supplied room name. Socket authorization checks the project and current authenticated user before joining. This prevents a user from subscribing to another tenant’s activity by guessing an ID.

## 8. Notifications

Notifications are stored in PostgreSQL with `read_at`. Mention processing is done transactionally with the comment creation flow where practical. A notification bell queries unread records and can mark one or all notifications as read.

A future scale improvement would be a background queue for mention parsing and notification fan-out. For this assignment, synchronous creation is simpler and provides deterministic tests.

## 9. Reports

Reports aggregate task records by assignee. Completion rate is completed tasks divided by assigned tasks. Average cycle time is calculated from `created_at` to `completed_at` for completed tasks.

The report endpoint returns JSON for the dashboard and a CSV endpoint formats the same aggregate result. CSV is generated on the server to avoid leaking raw task data to a browser-side export library.

## 10. Security

Supabase RLS is enabled on all tenant-owned tables. Policies check membership through a security-definer helper function. The helper avoids recursive policy evaluation when a policy needs to query `team_members`.

The API performs authorization checks for friendly errors and business rules, but RLS is still the database backstop. Secrets are environment variables, the service-role key is server-only, and `.gitignore` excludes environment files.

Sentry is integrated at the Express error boundary. The production deployment should configure a DSN and source-map handling appropriate to the hosting provider.

## 11. Reliability and Trade-offs

The design favors a modular monolith over microservices. This reduces deployment complexity, makes transactions straightforward, and is appropriate for an early collaboration product. Socket.io and Supabase are separately replaceable components.

The biggest deliberate trade-off is using a server-side service-role client for selected administrative operations. It is operationally convenient, but such endpoints must validate membership and role before executing. Client-side Supabase access is protected by RLS; server privileged operations must not be exposed as generic CRUD.

## 12. Deployment

Frontend and backend can be deployed independently. The frontend needs only public Supabase URL/anon configuration and the API URL. The backend needs private service-role credentials. CI runs install, tests and coverage before merge. Main branch protection should require the CI status check and at least one approving review.

## 13. Future Evolution

At higher scale, add Redis for Socket.io adapters, a queue for notification jobs, object storage for attachments, cursor pagination for feeds, audit logs with retention rules, rate limiting, and a dedicated search service. Database read replicas could serve reporting workloads. The current schema is intentionally normalized enough to support those changes without changing the tenant boundary.
