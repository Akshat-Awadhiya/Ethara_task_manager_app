import { Router } from "express";
import { Prisma, Role, TaskStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const visibleTasks: Prisma.TaskWhereInput = req.user!.role === Role.ADMIN
      ? {}
      : { project: { memberships: { some: { userId: req.user!.id } } } };

    const now = new Date();

    const [total, overdue, statusGroups, priorityGroups, recentTasks, lowQuality] = await Promise.all([
      prisma.task.count({ where: visibleTasks }),
      prisma.task.count({
        where: {
          ...visibleTasks,
          dueDate: { lt: now },
          status: { not: TaskStatus.DONE }
        }
      }),
      prisma.task.groupBy({
        by: ["status"],
        where: visibleTasks,
        _count: true
      }),
      prisma.task.groupBy({
        by: ["priority"],
        where: visibleTasks,
        _count: true
      }),
      prisma.task.findMany({
        where: visibleTasks,
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } }
        },
        orderBy: { updatedAt: "desc" },
        take: 6
      }),
      prisma.task.findMany({
        where: { ...visibleTasks, qualityScore: { gt: 0, lt: 70 } },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { qualityScore: "asc" },
        take: 5
      })
    ]);

    const statusCounts = Object.fromEntries(statusGroups.map((item) => [item.status, item._count]));
    const priorityCounts = Object.fromEntries(priorityGroups.map((item) => [item.priority, item._count]));

    res.json({
      summary: {
        total,
        overdue,
        completed: statusCounts.DONE ?? 0,
        inProgress: statusCounts.IN_PROGRESS ?? 0,
        blocked: statusCounts.BLOCKED ?? 0
      },
      statusCounts,
      priorityCounts,
      recentTasks,
      lowQuality
    });
  })
);

export default router;
