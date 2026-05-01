import type { AuditLog, Dashboard, Project, ProjectRole, Task, TaskStatus, User } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "team-task-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  async signup(input: { name: string; email: string; password: string }) {
    return request<{ user: User; token: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async login(input: { email: string; password: string }) {
    return request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async me() {
    return request<{ user: User }>("/api/auth/me");
  },
  async dashboard() {
    return request<Dashboard>("/api/dashboard");
  },
  async users() {
    return request<{ users: User[] }>("/api/users");
  },
  async projects() {
    return request<{ projects: Project[] }>("/api/projects");
  },
  async project(projectId: string) {
    return request<{ project: Project }>(`/api/projects/${projectId}`);
  },
  async createProject(input: { name: string; description?: string }) {
    return request<{ project: Project }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async deleteProject(projectId: string) {
    return request<void>(`/api/projects/${projectId}`, {
      method: "DELETE"
    });
  },
  async addMember(projectId: string, input: { email: string; role: ProjectRole }) {
    return request<{ membership: unknown }>(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async removeMember(projectId: string, userId: string) {
    return request<void>(`/api/projects/${projectId}/members/${userId}`, {
      method: "DELETE"
    });
  },
  async tasks(projectId?: string) {
    return request<{ tasks: Task[] }>(projectId ? `/api/tasks?projectId=${projectId}` : "/api/tasks");
  },
  async createTask(input: {
    title: string;
    description?: string;
    projectId: string;
    assigneeId?: string;
    priority: string;
    dueDate?: string;
  }) {
    return request<{ task: Task }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async updateTask(taskId: string, input: { status?: TaskStatus; statusReason?: string; assigneeId?: string | null }) {
    return request<{ task: Task }>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  async evaluateTask(taskId: string, input: {
    accuracyScore: number;
    completenessScore: number;
    timelinessScore: number;
    evaluationNotes?: string;
  }) {
    return request<{ task: Task }>(`/api/tasks/${taskId}/evaluation`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  async audit() {
    return request<{ auditLogs: AuditLog[] }>("/api/audit");
  }
};
