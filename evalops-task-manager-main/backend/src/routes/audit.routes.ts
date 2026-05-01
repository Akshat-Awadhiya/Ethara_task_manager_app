import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({
    query: z.object({
      projectId: z.string().optional()
    })
  }),
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const where = req.user!.role === Role.ADMIN
      ? { projectId }
      : {
          projectId,
          OR: [
            { actorId: req.user!.id },
            { project: { memberships: { some: { userId: req.user!.id } } } }
          ]
        };

    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    res.json({ auditLogs });
  })
);

export default router;
