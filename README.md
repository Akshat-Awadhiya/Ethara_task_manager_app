# Team Task Manager

Production-ready full-stack application for managing team projects, members, tasks, deadlines, and delivery progress. The app is built to demonstrate senior-level backend structure, relational data modeling, role-based access control, and a polished React workspace.

## Step 1: Architecture Explanation

**Stack**

- Frontend: React, TypeScript, Vite, Recharts, Lucide icons
- Backend: Node.js, Express, TypeScript, Prisma
- Database: PostgreSQL
- Auth: JWT bearer tokens with bcrypt password hashing
- Deployment: Railway web service with Railway PostgreSQL

**Application structure**

```txt
frontend/
  src/
    App.tsx              Auth, dashboard, project control, audit UI
    lib/api.ts           Typed REST client
    types.ts             Frontend domain types
    styles.css           Responsive light/dark product UI

backend/
  prisma/schema.prisma   PostgreSQL schema, enums, relations, indexes
  src/
    app.ts               Express app, security middleware, route mounting
    routes/              REST resources for auth, users, projects, tasks, dashboard, audit
    middleware/          JWT auth, role checks, validation, errors
    lib/                 password/JWT helpers, audit logging, task scoring
    db/prisma.ts         Prisma client
```

**Production decisions**

- Backend validates every payload with Zod before business logic runs.
- Passwords are hashed with bcrypt and never returned from the API.
- Global roles are `ADMIN` and `MEMBER`.
- Admins create/delete projects, add/remove members, create/assign tasks, and evaluate quality.
- Members can view assigned/visible work and update status on tasks assigned to them.
- Express serves the built React app in production so Railway can deploy one web service.

## Step 2: Database Schema Design

The schema is normalized around five core models:

- `User`: login identity, global role, active flag, owned projects, memberships, created tasks, assigned tasks.
- `Project`: owner, description, memberships, tasks, audit logs.
- `ProjectMembership`: join table for `User` to `Project`, with project-level role metadata.
- `Task`: project, creator, optional assignee, status, priority, deadline, completion timestamp, quality scores.
- `AuditLog`: immutable activity trail with actor, action, entity, optional project, before/after payloads.

Important relationships:

- Users and projects are many-to-many through `ProjectMembership`.
- Tasks belong to one project and can be assigned to one user.
- Project deletion cascades memberships, tasks, and project audit logs.
- Removing a project member unassigns their tasks before deleting the membership.

Schema file: `backend/prisma/schema.prisma`

## Step 3: Backend Implementation

**REST API**

Authentication:

- `POST /api/auth/signup` - create account; first user becomes admin.
- `POST /api/auth/login` - return user profile and JWT.
- `GET /api/auth/me` - validate token and return current user.

Users:

- `GET /api/users` - list users for assignment and admin review.
- `PATCH /api/users/:id` - admin-only role/status update.

Projects:

- `GET /api/projects` - list projects visible to current user.
- `POST /api/projects` - admin-only project creation.
- `GET /api/projects/:projectId` - project details with members.
- `DELETE /api/projects/:projectId` - admin-only project deletion.
- `POST /api/projects/:projectId/members` - admin-only add/update member.
- `DELETE /api/projects/:projectId/members/:userId` - admin-only member removal.

Tasks:

- `GET /api/tasks?projectId=&status=&assigneeId=` - filterable task list.
- `POST /api/tasks` - admin-only task creation and assignment.
- `PATCH /api/tasks/:taskId` - admin/project manager metadata updates; assignee status updates.
- `PATCH /api/tasks/:taskId/evaluation` - admin-only quality scoring.

Dashboard and audit:

- `GET /api/dashboard` - totals, overdue count, status distribution, priority distribution, watchlists.
- `GET /api/audit?projectId=` - recent activity visible to current user.
- `GET /api/health` - Railway health check.

Backend quality highlights:

- `helmet`, CORS, JSON body limits, request logging, API rate limiting.
- Centralized async and error middleware.
- JWT middleware attaches a safe user object to each request.
- Zod validation for params, query strings, and request bodies.
- Guarded task status transitions and blocked-task reason enforcement.

## Step 4: Frontend Implementation

The React UI includes:

- Login/signup shell with validation-friendly form constraints.
- Dashboard with KPI cards, status chart, overdue delivery alerts, and Kanban board.
- Project control screen for admin project creation/deletion, member management, and task creation.
- Audit trail with actor/action/timestamp visibility.
- Responsive layout for desktop and mobile.
- Typed API client and domain models.
- Sprint health, assigned-vs-completed metrics, workload balance, and deadline radar.

Wow-factor features included:

- Drag-and-drop Kanban status updates.
- Search and filters by text, priority, assignee, and overdue state.
- Dark mode toggle with persisted preference.
- In-app toast notifications for success/error feedback.
- Polling refresh every 30 seconds for lightweight near-real-time updates.
- Smooth hover and toast animations.
- Operational analytics panels that make the dashboard feel like a real team command center.

## Submission Assets

- Live URL: `https://evalops-web-production.up.railway.app`
- GitHub repo: `https://github.com/sunchuhasika/evalops-task-manager`
- Text README for upload: `SUBMISSION_README.txt`
- Demo video script: `DEMO_VIDEO_SCRIPT.txt`
- Demo admin: `admin@example.com` / `Password123!`
- Demo member: `member@example.com` / `Password123!`

## Step 5: Deployment Steps (Railway)

1. Push the repository to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Add a Railway PostgreSQL service.
4. Set web service variables:
   - `DATABASE_URL` = Railway PostgreSQL connection string
   - `JWT_SECRET` = long random value, at least 24 characters
   - `NODE_ENV` = `production`
   - `CLIENT_ORIGIN` = deployed Railway app URL
   - `PORT` = optional locally; Railway injects it automatically
5. Railway uses `railway.json`:
   - Build: `npm install && npm run build`
   - Start: `npm run railway:start`
   - Migration: `prisma migrate deploy`
   - Health check: `/api/health`
6. Optional seed after deploy:

```bash
npm run db:seed
```

## Local Setup

Install dependencies:

```bash
npm install
```

Start local PostgreSQL with Docker:

```bash
docker compose up -d
```

Create `.env` from `.env.example`, then run migrations and seed data:

```bash
cp .env.example .env
npm run db:migrate
npm run db:seed
```

Start backend and frontend:

```bash
npm run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- API health: `http://localhost:8080/api/health`

Seed users:

- Admin: `admin@example.com` / `Password123!`
- Member: `member@example.com` / `Password123!`

## Step 6: Final Polish Suggestions

- Add WebSockets for push-based task and audit updates.
- Add email invitations with expiring invite tokens.
- Add project-level analytics such as cycle time and workload balance.
- Add automated API tests with a disposable PostgreSQL test database.
- Add Dockerfile-based deployment as an alternative to Nixpacks.
