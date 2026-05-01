Team Task Manager - Full-Stack Assignment Submission

Live Application URL:
https://evalops-web-production.up.railway.app

GitHub Repository:
https://github.com/sunchuhasika/evalops-task-manager

Demo Credentials:
Admin:
  Email: admin@example.com
  Password: Password123!

Member:
  Email: member@example.com
  Password: Password123!

Project Summary:
Team Task Manager is a production-ready full-stack web app where teams can create projects, manage members, assign tasks, track status, and monitor progress through a dashboard.

Core Features Implemented:
1. Authentication
   - Signup and login with JWT authentication.
   - Secure bcrypt password hashing.
   - Zod validation on backend request bodies.

2. Role-Based Access Control
   - Global roles: ADMIN and MEMBER.
   - Admin can create/delete projects, add/remove members, create/assign tasks, and evaluate task quality.
   - Member can view assigned projects/tasks and update status on assigned work.

3. Project and Team Management
   - Create projects.
   - Add existing users to project teams.
   - Remove project members safely.
   - View project details and member roles.

4. Task Management
   - Create tasks with title, description, deadline, priority, assignee, and project.
   - Status tracking: Todo, In Progress, In Review, Done, Blocked.
   - Overdue detection.
   - Guarded status transitions.
   - Blocked tasks require a reason.

5. Dashboard
   - Status summary cards.
   - Status distribution chart.
   - Overdue delivery alerts.
   - Assigned vs completed task metrics.
   - Sprint health completion indicator.
   - Workload balance by team member.
   - Deadline radar for upcoming due dates.

Advanced Features:
1. Drag-and-drop Kanban board.
2. Search and filters by text, priority, assignee, and overdue status.
3. Dark mode toggle with persistent preference.
4. In-app notifications/toasts.
5. Activity/audit log showing who changed what and when.
6. Polling refresh for near-real-time updates.
7. Quality scoring workflow for task review.

Tech Stack:
Frontend:
  React, TypeScript, Vite, Recharts, Lucide React

Backend:
  Node.js, Express, TypeScript, Prisma

Database:
  PostgreSQL

Deployment:
  Railway web service with Railway PostgreSQL

Important API Routes:
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me
GET    /api/users
PATCH  /api/users/:id
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
DELETE /api/projects/:projectId
POST   /api/projects/:projectId/members
DELETE /api/projects/:projectId/members/:userId
GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/:taskId
PATCH  /api/tasks/:taskId/evaluation
GET    /api/dashboard
GET    /api/audit
GET    /api/health

Database Design:
The schema uses normalized relationships:
- User owns projects, belongs to projects through ProjectMembership, creates tasks, and can be assigned tasks.
- Project has one owner, many memberships, many tasks, and audit logs.
- ProjectMembership stores each user's project role.
- Task belongs to one project, has one creator, optional assignee, status, priority, due date, and scoring fields.
- AuditLog records important system activity with actor, action, entity, and timestamp.

Local Setup:
1. Install dependencies:
   npm install

2. Start local PostgreSQL or use Docker:
   docker compose up -d

3. Create .env from .env.example.

4. Run migrations and seed data:
   npm run db:migrate
   npm run db:seed

5. Start the app:
   npm run dev

Local URLs:
Frontend: http://localhost:5173
API health: http://localhost:8080/api/health

Railway Deployment:
The project includes railway.json. Railway runs:
- Build: npm install && npm run build
- Start: npm run railway:start
- Migrations: prisma migrate deploy
- Health check: /api/health

Submission Notes:
This app is live, deployed on Railway, and designed to show backend correctness, database relationships, RBAC, validations, polished UI, and production-style deployment readiness.
