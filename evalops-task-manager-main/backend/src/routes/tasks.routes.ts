import { Router } from "express";
import { AuditAction, Prisma, ProjectRole, Role, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../lib/http.js";
import { writeAuditLog } from "../lib/audit.js";
import { assertUserIsProjectMember, requireProjectAccess, requireProjectManager } from "./access.js";
import { calculateQualityScore, validateScores, validateStatusTransition } from "../lib/taskEvaluation.js";

const router = Router();

router.use(requireAuth);

const taskInclude = {
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true } },
  creator: { select: { id: true, name: true, email: true } }
} satisfies Prisma.TaskInclude;

function canEditTask(userRole: Role, projectRole: ProjectRole, userId: string, assigneeId?: string | null) {
  return userRole === Role.ADMIN || projectRole === ProjectRole.OWNER || projectRole === ProjectRole.MANAGER || assigneeId === userId;
}

router.get(
  "/",
  validate({
    query: z.object({
      projectId: z.string().optional(),
      status: z.nativeEnum(TaskStatus).optional(),
      assigneeId: z.string().optional()
    })
  }),
  asyncHandler(async (req, res) => {
    const query = req.query as { projectId?: string; status?: TaskStatus; assigneeId?: string };
    const where: Prisma.TaskWhereInput = {
      status: query.status,
      assigneeId: query.assigneeId
    };

    if (query.projectId) {
      await requireProjectAccess(req.user!.id, req.user!.role, query.projectId);
      where.projectId = query.projectId;
    } else if (req.user!.role !== Role.ADMIN) {
      where.project = { memberships: { some: { userId: req.user!.id } } };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }]
    });

    res.json({ tasks });
  })
);

router.post(
  "/",
  requireRole([Role.ADMIN]),
  validate({
    body: z.object({
      title: z.string().min(3).max(160),
      description: z.string().max(2000).optional(),
      projectId: z.string().min(1),
      assigneeId: z.string().min(1).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
      dueDate: z.string().datetime().optional()
    })
  }),
  asyncHandler(async (req, res) => {
    await requireProjectManager(req.user!.id, req.user!.role, req.body.projectId);
    if (req.body.assigneeId) {
      await assertUserIsProjectMember(req.body.projectId, req.body.assigneeId);
    }

    const task = await prisma.task.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        projectId: req.body.projectId,
        creatorId: req.user!.id,
        assigneeId: req.body.assigneeId,
        priority: req.body.priority,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined
      },
      include: taskInclude
    });

    await writeAuditLog({
      action: AuditAction.CREATE,
      entityType: "Task",
      entityId: task.id,
      summary: `Created task ${task.title}`,
      actorId: req.user!.id,
      projectId: task.projectId,
      after: task
    });

    res.status(201).json({ task });
  })
);

router.patch(
  "/:taskId",
  validate({
    params: z.object({ taskId: z.string().min(1) }),
    body: z.object({
      title: z.string().min(3).max(160).optional(),
      description: z.string().max(2000).nullable().optional(),
      assigneeId: z.string().min(1).nullable().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      dueDate: z.string().datetime().nullable().optional(),
      status: z.nativeEnum(TaskStatus).optional(),
      statusReason: z.string().max(500).nullable().optional()
    })
  }),
  asyncHandler(async (req, res) => {
    const before = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!before) throw new AppError(404, "Task not found");

    const membership = await requireProjectAccess(req.user!.id, req.user!.role, before.projectId);
    const isManager = req.user!.role === Role.ADMIN || membership.role === ProjectRole.OWNER || membership.role === ProjectRole.MANAGER;
    const isAssignee = before.assigneeId === req.user!.id;
    const changedFields = Object.keys(req.body);

    if (!canEditTask(req.user!.role, membership.role, req.user!.id, before.assigneeId)) {
      throw new AppError(403, "Only managers or the assignee can update this task");
    }

    if (!isManager && isAssignee) {
      const memberAllowedFields = new Set(["status", "statusReason"]);
      const hasRestrictedField = changedFields.some((field) => !memberAllowedFields.has(field));
      if (hasRestrictedField) {
        throw new AppError(403, "Members can only update the status of their assigned tasks");
      }
    }

    if (req.body.assigneeId !== undefined) {
      if (req.user!.role !== Role.ADMIN) {
        throw new AppError(403, "Only admins can assign tasks");
      }
      if (req.body.assigneeId) {
        await assertUserIsProjectMember(before.projectId, req.body.assigneeId);
      }
    }

    const nextStatus = req.body.status ?? before.status;
    validateStatusTransition(before.status, nextStatus, req.body.statusReason ?? before.statusReason ?? undefined);

    const completedAt = nextStatus === TaskStatus.DONE && before.status !== TaskStatus.DONE
      ? new Date()
      : nextStatus !== TaskStatus.DONE
        ? null
        : before.completedAt;

    const task = await prisma.task.update({
      where: { id: before.id },
      data: {
        title: req.body.title,
        description: req.body.description,
        assigneeId: req.body.assigneeId,
        priority: req.body.priority,
        dueDate: req.body.dueDate === undefined ? undefined : req.body.dueDate ? new Date(req.body.dueDate) : null,
        status: req.body.status,
        statusReason: req.body.statusReason,
        completedAt
      },
      include: taskInclude
    });

    await writeAuditLog({
      action: before.status !== task.status ? AuditAction.STATUS_CHANGE : AuditAction.UPDATE,
      entityType: "Task",
      entityId: task.id,
      summary: `Updated task ${task.title}`,
      actorId: req.user!.id,
      projectId: task.projectId,
      before,
      after: task
    });

    res.json({ task });
  })
);

router.patch(
  "/:taskId/evaluation",
  requireRole([Role.ADMIN]),
  validate({
    params: z.object({ taskId: z.string().min(1) }),
    body: z.object({
      accuracyScore: z.number().int().min(0).max(100),
      completenessScore: z.number().int().min(0).max(100),
      timelinessScore: z.number().int().min(0).max(100),
      evaluationNotes: z.string().max(1000).optional()
    })
  }),
  asyncHandler(async (req, res) => {
    const before = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!before) throw new AppError(404, "Task not found");

    await requireProjectManager(req.user!.id, req.user!.role, before.projectId);
    validateScores(req.body);

    const qualityScore = calculateQualityScore(req.body);
    const task = await prisma.task.update({
      where: { id: before.id },
      data: {
        accuracyScore: req.body.accuracyScore,
        completenessScore: req.body.completenessScore,
        timelinessScore: req.body.timelinessScore,
        qualityScore,
        evaluationNotes: req.body.evaluationNotes
      },
      include: taskInclude
    });

    await writeAuditLog({
      action: AuditAction.UPDATE,
      entityType: "TaskEvaluation",
      entityId: task.id,
      summary: `Scored task ${task.title} at ${qualityScore}`,
      actorId: req.user!.id,
      projectId: task.projectId,
      before,
      after: task
    });

    res.json({ task });
  })
);

export default router;
