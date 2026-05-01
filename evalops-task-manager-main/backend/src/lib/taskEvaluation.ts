import { TaskStatus } from "@prisma/client";
import { AppError } from "./http.js";

export type EvaluationInput = {
  accuracyScore?: number;
  completenessScore?: number;
  timelinessScore?: number;
};

export function calculateQualityScore(input: EvaluationInput) {
  const accuracy = input.accuracyScore ?? 0;
  const completeness = input.completenessScore ?? 0;
  const timeliness = input.timelinessScore ?? 0;

  return Math.round((accuracy * 0.45 + completeness * 0.35 + timeliness * 0.2) * 10) / 10;
}

export function validateScores(input: EvaluationInput) {
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new AppError(400, `${key} must be an integer between 0 and 100`);
    }
  }
}

const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  TODO: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
  IN_PROGRESS: [TaskStatus.IN_REVIEW, TaskStatus.BLOCKED, TaskStatus.TODO],
  IN_REVIEW: [TaskStatus.DONE, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
  DONE: [TaskStatus.IN_REVIEW],
  BLOCKED: [TaskStatus.TODO, TaskStatus.IN_PROGRESS]
};

export function validateStatusTransition(from: TaskStatus, to: TaskStatus, reason?: string) {
  if (from === to) return;

  if (!allowedTransitions[from].includes(to)) {
    throw new AppError(400, `Invalid status transition from ${from} to ${to}`);
  }

  if (to === TaskStatus.BLOCKED && !reason?.trim()) {
    throw new AppError(400, "Blocking a task requires a statusReason");
  }
}
