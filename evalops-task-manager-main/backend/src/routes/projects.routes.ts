import { Router } from "express";
import { AuditAction, ProjectRole, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../lib/http.js";
import { writeAuditLog } from "../lib/audit.js";
import { requireProjectAccess, requireProjectManager } from "./access.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = req.user!.role === Role.ADMIN
      ? {}
      : { memberships: { some: { userId: req.user!.id } } };

    const projects = await prisma.project.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true, memberships: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ projects });
  })
);

router.post(
  "/",
  requireRole([Role.ADMIN]),
  validate({
    body: z.object({
      name: z.string().min(2).max(120),
      description: z.string().max(1000).optional()
    })
  }),
  asyncHandler(async (req, res) => {
    const project = await prisma.project.create({
      data: {
        name: req.body.name,
        description: req.body.description,
        ownerId: req.user!.id,
        memberships: { create: { userId: req.user!.id, role: ProjectRole.OWNER } }
      },
      include: { owner: { select: { id: true, name: true, email: true } } }
    });

    await writeAuditLog({
      action: AuditAction.CREATE,
      entityType: "Project",
      entityId: project.id,
      summary: `Created project ${project.name}`,
      actorId: req.user!.id,
      projectId: project.id,
      after: project
    });

    res.status(201).json({ project });
  })
);

router.delete(
  "/:projectId",
  requireRole([Role.ADMIN]),
  validate({ params: z.object({ projectId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { _count: { select: { tasks: true, memberships: true } } }
    });

    if (!project) throw new AppError(404, "Project not found");

    await prisma.project.delete({ where: { id: project.id } });

    await writeAuditLog({
      action: AuditAction.DELETE,
      entityType: "Project",
      entityId: project.id,
      summary: `Deleted project ${project.name}`,
      actorId: req.user!.id,
      before: project
    });

    res.status(204).send();
  })
);

router.get(
  "/:projectId",
  validate({ params: z.object({ projectId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    await requireProjectAccess(req.user!.id, req.user!.role, req.params.projectId);

    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        memberships: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!project) throw new AppError(404, "Project not found");
    res.json({ project });
  })
);

router.post(
  "/:projectId/members",
  requireRole([Role.ADMIN]),
  validate({
    params: z.object({ projectId: z.string().min(1) }),
    body: z.object({
      email: z.string().email().toLowerCase(),
      role: z.enum(["MANAGER", "CONTRIBUTOR"]).default(ProjectRole.CONTRIBUTOR)
    })
  }),
  asyncHandler(async (req, res) => {
    await requireProjectManager(req.user!.id, req.user!.role, req.params.projectId);

    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) throw new AppError(404, "User not found");

    const membership = await prisma.projectMembership.upsert({
      where: { projectId_userId: { projectId: req.params.projectId, userId: user.id } },
      update: { role: req.body.role },
      create: { projectId: req.params.projectId, userId: user.id, role: req.body.role },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    await writeAuditLog({
      action: AuditAction.MEMBER_CHANGE,
      entityType: "ProjectMembership",
      entityId: membership.id,
      summary: `Added or updated member ${user.email}`,
      actorId: req.user!.id,
      projectId: req.params.projectId,
      after: membership
    });

    res.status(201).json({ membership });
  })
);

router.delete(
  "/:projectId/members/:userId",
  requireRole([Role.ADMIN]),
  validate({
    params: z.object({
      projectId: z.string().min(1),
      userId: z.string().min(1)
    })
  }),
  asyncHandler(async (req, res) => {
    await requireProjectManager(req.user!.id, req.user!.role, req.params.projectId);

    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) throw new AppError(404, "Project not found");
    if (project.ownerId === req.params.userId) {
      throw new AppError(400, "Project owner cannot be removed");
    }

    const membership = await prisma.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId: req.params.projectId,
          userId: req.params.userId
        }
      },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    if (!membership) throw new AppError(404, "Member not found on this project");

    await prisma.$transaction([
      prisma.task.updateMany({
        where: { projectId: req.params.projectId, assigneeId: req.params.userId },
        data: { assigneeId: null }
      }),
      prisma.projectMembership.delete({ where: { id: membership.id } })
    ]);

    await writeAuditLog({
      action: AuditAction.MEMBER_CHANGE,
      entityType: "ProjectMembership",
      entityId: membership.id,
      summary: `Removed member ${membership.user.email}`,
      actorId: req.user!.id,
      projectId: req.params.projectId,
      before: membership
    });

    res.status(204).send();
  })
);

export default router;
