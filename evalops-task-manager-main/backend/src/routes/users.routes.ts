import { Router } from "express";
import { AuditAction, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { writeAuditLog } from "../lib/audit.js";
import { AppError } from "../lib/http.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({ users });
  })
);

router.patch(
  "/:id",
  requireRole([Role.ADMIN]),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      role: z.nativeEnum(Role).optional(),
      isActive: z.boolean().optional()
    })
  }),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user?.id && req.body.isActive === false) {
      throw new AppError(400, "Admins cannot deactivate themselves");
    }

    const before = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, role: true, isActive: true }
    });
    if (!before) throw new AppError(404, "User not found");

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: { id: true, email: true, name: true, role: true, isActive: true }
    });

    await writeAuditLog({
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: user.id,
      summary: `Updated user ${user.email}`,
      actorId: req.user!.id,
      before,
      after: user
    });

    res.json({ user });
  })
);

export default router;
