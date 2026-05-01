import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../lib/http.js";
import { env } from "../config/env.js";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `Route not found: ${req.method} ${req.path}`));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: error.flatten()
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status = error.code === "P2002" ? 409 : 400;
    res.status(status).json({ error: "Database constraint failed", code: error.code });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message, details: error.details });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: "Internal server error",
    details: env.NODE_ENV === "development" ? String(error) : undefined
  });
}
