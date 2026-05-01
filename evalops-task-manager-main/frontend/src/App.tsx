import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FolderPlus,
  Gauge,
  LogOut,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  TrendingUp,
  Trash2,
  Users
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, clearToken, getToken, setToken } from "./lib/api";
import type { AuditLog, Dashboard, Priority, Project, ProjectRole, Task, TaskStatus, User } from "./types";

const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];
const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

type View = "dashboard" | "projects" | "audit";
type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [view, setView] = useState<View>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDetail, setProjectDetail] = useState<Project | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("team-task-theme") === "dark");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | Priority>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const isAdmin = user?.role === "ADMIN";
  const activeProject = projectDetail ?? projects.find((project) => project.id === activeProjectId) ?? null;

  function notify(message: string, tone: Toast["tone"] = "info") {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }

  async function runAction(action: () => Promise<void>, success: string) {
    setError("");
    try {
      await action();
      notify(success, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      notify(message, "error");
    }
  }

  async function loadData(projectId = activeProjectId) {
    setLoading(true);
    setError("");
    try {
      const [dashboardData, projectData, userData, auditData] = await Promise.all([
        api.dashboard(),
        api.projects(),
        api.users(),
        api.audit()
      ]);

      const selectedProjectId = projectId || projectData.projects[0]?.id || "";
      const [taskData, detailData] = await Promise.all([
        api.tasks(selectedProjectId || undefined),
        selectedProjectId ? api.project(selectedProjectId) : Promise.resolve({ project: null as Project | null })
      ]);

      setDashboard(dashboardData);
      setProjects(projectData.projects);
      setUsers(userData.users);
      setTasks(taskData.tasks);
      setAuditLogs(auditData.auditLogs);
      setActiveProjectId(selectedProjectId);
      setProjectDetail(detailData.project);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("team-task-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!getToken()) return;
    api.me()
      .then(({ user: me }) => {
        setUser(me);
        return loadData();
      })
      .catch(() => {
        clearToken();
        setUser(null);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => loadData(activeProjectId), 30000);
    return () => window.clearInterval(timer);
  }, [user, activeProjectId]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? "")
    };

    try {
      const response = mode === "signup"
        ? await api.signup(payload)
        : await api.login({ email: payload.email, password: payload.password });
      setToken(response.token);
      setUser(response.user);
      notify(`Welcome, ${response.user.name}`, "success");
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      notify(message, "error");
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    setDashboard(null);
    setProjects([]);
    setTasks([]);
    setProjectDetail(null);
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api.createProject({
        name: String(form.get("name")),
        description: String(form.get("description") || "")
      });
      event.currentTarget.reset();
      await loadData();
    }, "Project created");
  }

  async function deleteProject(projectId: string) {
    if (!window.confirm("Delete this project and all of its tasks?")) return;
    await runAction(async () => {
      await api.deleteProject(projectId);
      setProjectDetail(null);
      await loadData("");
    }, "Project deleted");
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProjectId) return;
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api.addMember(activeProjectId, {
        email: String(form.get("email")),
        role: String(form.get("role")) as ProjectRole
      });
      event.currentTarget.reset();
      await loadData(activeProjectId);
    }, "Member added");
  }

  async function removeMember(userId: string) {
    if (!activeProjectId) return;
    await runAction(async () => {
      await api.removeMember(activeProjectId, userId);
      await loadData(activeProjectId);
    }, "Member removed");
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProjectId) return;
    const form = new FormData(event.currentTarget);
    const dueDate = String(form.get("dueDate") || "");
    const assigneeId = String(form.get("assigneeId") || "");
    await runAction(async () => {
      await api.createTask({
        projectId: activeProjectId,
        title: String(form.get("title")),
        description: String(form.get("description") || ""),
        assigneeId: assigneeId || undefined,
        priority: String(form.get("priority")),
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined
      });
      event.currentTarget.reset();
      await loadData(activeProjectId);
    }, "Task created");
  }

  async function updateStatus(task: Task, status: TaskStatus) {
    if (task.status === status) return;
    const statusReason = status === "BLOCKED" ? window.prompt("Reason for blocking this task?") ?? "" : undefined;
    await runAction(async () => {
      await api.updateTask(task.id, { status, statusReason });
      await loadData(activeProjectId);
    }, `Task moved to ${label(status)}`);
  }

  async function evaluate(task: Task) {
    await runAction(async () => {
      await api.evaluateTask(task.id, {
        accuracyScore: 90,
        completenessScore: task.description ? 86 : 72,
        timelinessScore: isOverdue(task) ? 45 : 95,
        evaluationNotes: "Rule-based demo score from task metadata."
      });
      await loadData(activeProjectId);
    }, "Task quality score updated");
  }

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch = !query
        || task.title.toLowerCase().includes(query)
        || (task.description ?? "").toLowerCase().includes(query)
        || task.project.name.toLowerCase().includes(query)
        || (task.assignee?.name ?? "").toLowerCase().includes(query);
      const matchesPriority = priorityFilter === "ALL" || task.priority === priorityFilter;
      const matchesAssignee = assigneeFilter === "ALL"
        || (assigneeFilter === "UNASSIGNED" ? !task.assigneeId : task.assigneeId === assigneeFilter);
      const matchesOverdue = !onlyOverdue || isOverdue(task);
      return matchesSearch && matchesPriority && matchesAssignee && matchesOverdue;
    });
  }, [tasks, search, priorityFilter, assigneeFilter, onlyOverdue]);

  const chartData = useMemo(() => {
    if (!dashboard) return [];
    return statuses.map((status) => ({
      status: label(status),
      count: dashboard.statusCounts[status] ?? 0
    }));
  }, [dashboard]);

  const completionRate = dashboard?.summary.total
    ? Math.round((dashboard.summary.completed / dashboard.summary.total) * 100)
    : 0;
  const assignedTasks = tasks.filter((task) => task.assigneeId).length;
  const completedAssignedTasks = tasks.filter((task) => task.assigneeId && task.status === "DONE").length;
  const myTasks = user ? tasks.filter((task) => task.assigneeId === user.id) : [];
  const myCompletedTasks = myTasks.filter((task) => task.status === "DONE").length;
  const upcomingTasks = tasks
    .filter((task) => task.dueDate && task.status !== "DONE")
    .sort((first, second) => new Date(first.dueDate ?? "").getTime() - new Date(second.dueDate ?? "").getTime())
    .slice(0, 5);

  const workload = useMemo(() => {
    const projectMemberIds = new Set((activeProject?.memberships ?? []).map((membership) => membership.user.id));
    const rows = users
      .filter((member) => projectMemberIds.size === 0 || projectMemberIds.has(member.id))
      .map((member) => {
        const assigned = tasks.filter((task) => task.assigneeId === member.id);
        return {
          user: member,
          assigned: assigned.length,
          completed: assigned.filter((task) => task.status === "DONE").length
        };
      });
    const maxAssigned = Math.max(1, ...rows.map((row) => row.assigned));
    return rows.map((row) => ({
      ...row,
      percent: Math.round((row.assigned / maxAssigned) * 100)
    }));
  }, [activeProject?.memberships, tasks, users]);

  const priorityHotlist = priorities.map((priority) => ({
    priority,
    count: tasks.filter((task) => task.priority === priority && task.status !== "DONE").length
  }));

  if (!user) {
    return (
      <main className="auth-shell">
        <ToastStack toasts={toasts} />
        <section className="auth-panel">
          <div className="brand-row">
            <span className="brand-mark"><ClipboardCheck size={20} /></span>
            <div>
              <h1>Team Task Manager</h1>
              <p>Projects, roles, assignments, and delivery insight in one workspace.</p>
            </div>
          </div>

          <div className="mode-switch" role="tablist">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Signup</button>
          </div>

          <form onSubmit={handleAuth} className="stack">
            {mode === "signup" && <input name="name" placeholder="Name" required minLength={2} />}
            <input name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Password" required minLength={8} />
            {error && <p className="error">{error}</p>}
            <button className="primary" type="submit">
              <ShieldCheck size={18} />
              {mode === "signup" ? "Create Account" : "Enter Workspace"}
            </button>
          </form>

          <p className="hint">Seed login after setup: admin@example.com / Password123!</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <ToastStack toasts={toasts} />
      <aside className="sidebar">
        <div className="brand-row compact">
          <span className="brand-mark"><ClipboardCheck size={18} /></span>
          <strong>Team Task Manager</strong>
        </div>
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><Gauge size={18} /> Dashboard</button>
          <button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}><Users size={18} /> Projects</button>
          <button className={view === "audit" ? "active" : ""} onClick={() => setView("audit")}><Activity size={18} /> Audit</button>
        </nav>
        <button className="ghost theme-toggle" onClick={() => setDarkMode((value) => !value)} title="Toggle dark mode">
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          {darkMode ? "Light" : "Dark"}
        </button>
        <button className="ghost logout" onClick={logout} title="Logout"><LogOut size={18} /> Logout</button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{user.role}</p>
            <h2>{view === "dashboard" ? "Operational Dashboard" : view === "projects" ? "Project Control" : "Audit Trail"}</h2>
          </div>
          <div className="user-pill">{user.name}</div>
        </header>

        {error && <p className="error page-error">{error}</p>}
        {loading && <div className="loading">Refreshing workspace...</div>}

        {view === "dashboard" && dashboard && (
          <>
            <section className="kpi-grid">
              <Kpi icon={<ClipboardCheck />} label="Total Tasks" value={dashboard.summary.total} />
              <Kpi icon={<Clock3 />} label="Overdue" value={dashboard.summary.overdue} tone="danger" />
              <Kpi icon={<Gauge />} label="In Progress" value={dashboard.summary.inProgress} />
              <Kpi icon={<Activity />} label="Blocked" value={dashboard.summary.blocked} tone="warning" />
            </section>

            <section className="split">
              <div className="panel">
                <h3>Status Distribution</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="status" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2f8f83" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="panel">
                <h3><Bell size={17} /> Delivery Alerts</h3>
                <TaskList tasks={tasks.filter(isOverdue).slice(0, 5)} empty="No overdue tasks." />
              </div>
            </section>

            <section className="insight-grid">
              <div className="panel health-panel">
                <h3><TrendingUp size={17} /> Sprint Health</h3>
                <div className="progress-combo">
                  <div
                    className="progress-ring"
                    style={{ "--progress": `${completionRate * 3.6}deg` } as CSSProperties}
                  >
                    <strong>{completionRate}%</strong>
                    <span>done</span>
                  </div>
                  <div className="insight-stack">
                    <MetricLine icon={<CheckCircle2 />} label="Assigned completed" value={`${completedAssignedTasks}/${assignedTasks}`} />
                    <MetricLine icon={<Users />} label="My completed work" value={`${myCompletedTasks}/${myTasks.length}`} />
                    <MetricLine icon={<AlertTriangle />} label="Open high priority" value={String(priorityHotlist.find((item) => item.priority === "HIGH")?.count ?? 0)} />
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3><Users size={17} /> Workload Balance</h3>
                <div className="workload-list">
                  {workload.map((row) => (
                    <article className="workload-row" key={row.user.id}>
                      <div>
                        <strong>{row.user.name}</strong>
                        <span>{row.completed}/{row.assigned} completed</span>
                      </div>
                      <div className="bar-track" aria-label={`${row.user.name} workload`}>
                        <span style={{ width: `${row.percent}%` }} />
                      </div>
                    </article>
                  ))}
                  {workload.length === 0 && <p className="empty">No workload yet.</p>}
                </div>
              </div>

              <div className="panel">
                <h3><CalendarDays size={17} /> Deadline Radar</h3>
                <div className="deadline-list">
                  {upcomingTasks.map((task) => (
                    <article className={isOverdue(task) ? "deadline-row overdue" : "deadline-row"} key={task.id}>
                      <div>
                        <strong>{task.title}</strong>
                        <span>{task.assignee?.name ?? "Unassigned"} - {task.project.name}</span>
                      </div>
                      <time>{formatDate(task.dueDate)}</time>
                    </article>
                  ))}
                  {upcomingTasks.length === 0 && <p className="empty">No upcoming deadlines.</p>}
                </div>
              </div>
            </section>

            <TaskFilters
              search={search}
              priorityFilter={priorityFilter}
              assigneeFilter={assigneeFilter}
              onlyOverdue={onlyOverdue}
              users={users}
              onSearch={setSearch}
              onPriority={setPriorityFilter}
              onAssignee={setAssigneeFilter}
              onOverdue={setOnlyOverdue}
            />
            <TaskBoard tasks={filteredTasks} isAdmin={isAdmin} onStatus={updateStatus} onEvaluate={evaluate} />
          </>
        )}

        {view === "projects" && (
          <section className="split">
            <div className="panel">
              <div className="panel-title">
                <h3>Projects</h3>
                {isAdmin && activeProjectId && (
                  <button className="icon-button danger" title="Delete project" onClick={() => deleteProject(activeProjectId)}>
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
              {isAdmin && (
                <form onSubmit={createProject} className="inline-form">
                  <input name="name" placeholder="Project name" required />
                  <input name="description" placeholder="Description" />
                  <button className="icon-button" title="Create project"><FolderPlus size={18} /></button>
                </form>
              )}
              <div className="project-list">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    className={project.id === activeProjectId ? "project-row active" : "project-row"}
                    onClick={() => loadData(project.id)}
                  >
                    <strong>{project.name}</strong>
                    <span>{project._count?.tasks ?? 0} tasks - {project._count?.memberships ?? 0} members</span>
                  </button>
                ))}
                {projects.length === 0 && <p className="empty">No projects yet.</p>}
              </div>
            </div>

            <div className="panel">
              <h3>{activeProject?.name ?? "Selected Project"}</h3>
              {activeProject?.description && <p className="project-description">{activeProject.description}</p>}

              <div className="member-list">
                {(activeProject?.memberships ?? []).map((membership) => (
                  <article key={membership.id} className="member-row">
                    <div>
                      <strong>{membership.user.name}</strong>
                      <span>{membership.user.email} - {membership.role}</span>
                    </div>
                    {isAdmin && membership.role !== "OWNER" && (
                      <button className="ghost icon-only" title="Remove member" onClick={() => removeMember(membership.user.id)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </article>
                ))}
              </div>

              {isAdmin && activeProjectId && (
                <>
                  <form onSubmit={addMember} className="inline-form spaced">
                    <input name="email" type="email" placeholder="Member email" required />
                    <select name="role" defaultValue="CONTRIBUTOR">
                      <option value="CONTRIBUTOR">Contributor</option>
                      <option value="MANAGER">Manager</option>
                    </select>
                    <button className="icon-button" title="Add member"><Plus size={18} /></button>
                  </form>

                  <form onSubmit={createTask} className="task-form">
                    <input name="title" placeholder="Task title" required minLength={3} />
                    <textarea name="description" placeholder="Task description" />
                    <select name="assigneeId" defaultValue="">
                      <option value="">Unassigned</option>
                      {(activeProject?.memberships ?? []).map((membership) => (
                        <option value={membership.user.id} key={membership.user.id}>{membership.user.name}</option>
                      ))}
                    </select>
                    <select name="priority" defaultValue="MEDIUM">
                      {priorities.map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}
                    </select>
                    <input name="dueDate" type="datetime-local" />
                    <button className="primary"><Plus size={18} /> Create Task</button>
                  </form>
                </>
              )}
            </div>
          </section>
        )}

        {view === "audit" && (
          <section className="panel">
            <h3>Recent Changes</h3>
            <div className="audit-list">
              {auditLogs.map((log) => (
                <article key={log.id} className="audit-row">
                  <span className="tag">{log.action}</span>
                  <div>
                    <strong>{log.summary}</strong>
                    <p>{log.actor.name} - {new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                </article>
              ))}
              {auditLogs.length === 0 && <p className="empty">No audit events yet.</p>}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function Kpi({ icon, label: text, value, tone }: { icon: JSX.Element; label: string; value: number; tone?: "danger" | "warning" }) {
  return (
    <article className={`kpi ${tone ?? ""}`}>
      <span>{icon}</span>
      <div>
        <p>{text}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function MetricLine({ icon, label: text, value }: { icon: JSX.Element; label: string; value: string }) {
  return (
    <div className="metric-line">
      <span>{icon}</span>
      <p>{text}</p>
      <strong>{value}</strong>
    </div>
  );
}

function TaskFilters(props: {
  search: string;
  priorityFilter: "ALL" | Priority;
  assigneeFilter: string;
  onlyOverdue: boolean;
  users: User[];
  onSearch: (value: string) => void;
  onPriority: (value: "ALL" | Priority) => void;
  onAssignee: (value: string) => void;
  onOverdue: (value: boolean) => void;
}) {
  return (
    <section className="filters">
      <label className="search-box">
        <Search size={17} />
        <input value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Search tasks, projects, assignees" />
      </label>
      <select value={props.priorityFilter} onChange={(event) => props.onPriority(event.target.value as "ALL" | Priority)}>
        <option value="ALL">All priorities</option>
        {priorities.map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}
      </select>
      <select value={props.assigneeFilter} onChange={(event) => props.onAssignee(event.target.value)}>
        <option value="ALL">All assignees</option>
        <option value="UNASSIGNED">Unassigned</option>
        {props.users.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
      </select>
      <label className="check-control">
        <input type="checkbox" checked={props.onlyOverdue} onChange={(event) => props.onOverdue(event.target.checked)} />
        Overdue only
      </label>
    </section>
  );
}

function TaskBoard({ tasks, isAdmin, onStatus, onEvaluate }: {
  tasks: Task[];
  isAdmin: boolean;
  onStatus: (task: Task, status: TaskStatus) => Promise<void>;
  onEvaluate: (task: Task) => Promise<void>;
}) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  return (
    <section className="board" aria-label="Kanban task board">
      {statuses.map((status) => (
        <div
          className="column"
          key={status}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            const task = tasks.find((item) => item.id === draggedTaskId);
            if (task) onStatus(task, status);
            setDraggedTaskId(null);
          }}
        >
          <h3>{label(status)}</h3>
          {tasks.filter((task) => task.status === status).map((task) => (
            <article
              className={`task-card ${isOverdue(task) ? "overdue" : ""}`}
              draggable
              onDragStart={() => setDraggedTaskId(task.id)}
              onDragEnd={() => setDraggedTaskId(null)}
              key={task.id}
            >
              <div className="task-head">
                <strong>{task.title}</strong>
                <span className={`priority ${task.priority.toLowerCase()}`}>{label(task.priority)}</span>
              </div>
              <p>{task.description || "No description"}</p>
              <div className="meta-row">
                <span>{task.project.name}</span>
                <span>{task.assignee?.name ?? "Unassigned"}</span>
              </div>
              <div className="meta-row">
                <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No deadline"}</span>
                {isOverdue(task) && <strong className="danger-text">Overdue</strong>}
              </div>
              <div className="score-row">
                <span>Quality</span>
                <meter min="0" max="100" value={task.qualityScore || 0} />
                <strong>{Math.round(task.qualityScore || 0)}</strong>
              </div>
              <div className="card-actions">
                <select value={task.status} onChange={(event) => onStatus(task, event.target.value as TaskStatus)}>
                  {statuses.map((option) => <option key={option} value={option}>{label(option)}</option>)}
                </select>
                {isAdmin && (
                  <button className="ghost" onClick={() => onEvaluate(task)} title="Run quality evaluation">
                    <Gauge size={16} /> Score
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}

function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (tasks.length === 0) return <p className="empty">{empty}</p>;

  return (
    <div className="watchlist">
      {tasks.map((task) => (
        <article key={task.id} className="watch-row">
          <div>
            <strong>{task.title}</strong>
            <span>{task.project.name}</span>
          </div>
          <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"}</span>
        </article>
      ))}
    </div>
  );
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast ${toast.tone}`} key={toast.id}>{toast.message}</div>
      ))}
    </div>
  );
}

function isOverdue(task: Task) {
  return Boolean(task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE");
}

function label(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}
