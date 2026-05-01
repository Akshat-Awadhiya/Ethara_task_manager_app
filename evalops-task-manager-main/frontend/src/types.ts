export type Role = "ADMIN" | "MEMBER";
export type ProjectRole = "OWNER" | "MANAGER" | "CONTRIBUTOR";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive?: boolean;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  owner?: Pick<User, "id" | "name" | "email">;
  memberships?: Array<{
    id: string;
    role: ProjectRole;
    user: User;
  }>;
  _count?: {
    tasks: number;
    memberships: number;
  };
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  completedAt?: string | null;
  accuracyScore: number;
  completenessScore: number;
  timelinessScore: number;
  qualityScore: number;
  statusReason?: string | null;
  evaluationNotes?: string | null;
  projectId: string;
  assigneeId?: string | null;
  project: Pick<Project, "id" | "name">;
  assignee?: Pick<User, "id" | "name" | "email"> | null;
  creator: Pick<User, "id" | "name" | "email">;
};

export type Dashboard = {
  summary: {
    total: number;
    overdue: number;
    completed: number;
    inProgress: number;
    blocked: number;
  };
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  recentTasks: Task[];
  lowQuality: Task[];
};

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  summary: string;
  actor: Pick<User, "id" | "name" | "email">;
  project?: Pick<Project, "id" | "name"> | null;
  createdAt: string;
};
