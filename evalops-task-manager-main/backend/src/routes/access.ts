import { ProjectRole, Role } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { AppError } from "../lib/http.js";

export async function requireProjectAccess(userId: string, userRole: Role, projectId: string) {
  if (userRole === Role.ADMIN) return { role: ProjectRole.OWNER };

  const membership = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true }
  });

  if (!membership) {
    throw new AppError(403, "You are not a member of this project");
  }

  return membership;
}

export async function requireProjectManager(userId: string, userRole: Role, projectId: string) {
  const membership = await requireProjectAccess(userId, userRole, projectId);
  const canManage = userRole === Role.ADMIN || membership.role === ProjectRole.OWNER || membership.role === ProjectRole.MANAGER;

  if (!canManage) {
    throw new AppError(403, "Project manager permissions required");
  }

  return membership;
}

export async function assertUserIsProjectMember(projectId: string, userId: string) {
  const membership = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId } }
  });

  if (!membership) {
    throw new AppError(400, "Assignee must be a project member");
  }
}
