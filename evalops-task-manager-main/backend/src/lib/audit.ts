import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

type AuditInput = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  summary: string;
  actorId: string;
  projectId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export function writeAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      actorId: input.actorId,
      projectId: input.projectId,
      before: input.before ?? Prisma.JsonNull,
      after: input.after ?? Prisma.JsonNull
    }
  });
}
