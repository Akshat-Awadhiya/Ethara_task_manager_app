import { PrismaClient, Priority, ProjectRole, Role, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Demo Admin",
      passwordHash,
      role: Role.ADMIN
    }
  });

  const member = await prisma.user.upsert({
    where: { email: "member@example.com" },
    update: {},
    create: {
      email: "member@example.com",
      name: "Demo Member",
      passwordHash,
      role: Role.MEMBER
    }
  });

  const project = await prisma.project.upsert({
    where: { id: "demo-project" },
    update: {},
    create: {
      id: "demo-project",
      name: "LLM Evaluation Ops",
      description: "Workflow for task assignment, quality review, and operational tracking.",
      ownerId: admin.id,
      memberships: {
        create: [
          { userId: admin.id, role: ProjectRole.OWNER },
          { userId: member.id, role: ProjectRole.CONTRIBUTOR }
        ]
      }
    }
  });

  const existing = await prisma.task.count({ where: { projectId: project.id } });
  if (existing === 0) {
    await prisma.task.createMany({
      data: [
        {
          title: "Define annotation rubric",
          description: "Convert project goals into measurable quality dimensions.",
          projectId: project.id,
          creatorId: admin.id,
          assigneeId: member.id,
          priority: Priority.HIGH,
          status: TaskStatus.IN_REVIEW,
          dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
          accuracyScore: 90,
          completenessScore: 85,
          timelinessScore: 100,
          qualityScore: 91
        },
        {
          title: "Review overdue edge cases",
          description: "Inspect missed deadlines and document blockers.",
          projectId: project.id,
          creatorId: admin.id,
          assigneeId: member.id,
          priority: Priority.URGENT,
          status: TaskStatus.BLOCKED,
          dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
          statusReason: "Waiting on source dataset clarification."
        }
      ]
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
