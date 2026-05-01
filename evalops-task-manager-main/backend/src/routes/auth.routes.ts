import { Router } from "express";
import { AuditAction, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { AppError } from "../lib/http.js";
import { writeAuditLog } from "../lib/audit.js";

const router = Router();

const signupSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100)
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1)
});

router.post(
  "/signup",
  validate({ body: signupSchema }),
  asyncHandler(async (req, res) => {
    const existingUsers = await prisma.user.count();
    const role = existingUsers === 0 ? Role.ADMIN : Role.MEMBER;
    const passwordHash = await hashPassword(req.body.password);

    const user = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        passwordHash,
        role
      },
      select: { id: true, email: true, name: true, role: true }
    });

    await writeAuditLog({
      action: AuditAction.AUTH,
      entityType: "User",
      entityId: user.id,
      summary: `User signed up as ${role}`,
      actorId: user.id,
      after: user
    });

    res.status(201).json({ user, token: signToken({ sub: user.id, role: user.role }) });
  })
);

router.post(
  "/login",
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user || !user.isActive) {
      throw new AppError(401, "Invalid credentials");
    }

    const ok = await verifyPassword(req.body.password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, "Invalid credentials");
    }

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token: signToken({ sub: user.id, role: user.role })
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

export default router;
