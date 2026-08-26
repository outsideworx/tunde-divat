import type { NextFunction, Request, Response } from "express";
import { isProduction } from "../config/env.js";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: T, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const isDatabaseConnectionError =
    err.name === "PrismaClientInitializationError" ||
    err.message.includes("Can't reach database server") ||
    err.message.includes("Database server") ||
    err.message.includes("P1001");
  const statusCode = err instanceof AppError ? err.statusCode : isDatabaseConnectionError ? 503 : 500;
  const message =
    err instanceof AppError
      ? err.message
      : isDatabaseConnectionError
        ? "Az adatbázis nem elérhető. Indítsd el a MySQL szervert, majd futtasd a migrációt és a teszt felhasználók seedelését."
        : "Internal server error";
  if (!isProduction && !(err instanceof AppError)) {
    console.error(err);
  }
  res.status(statusCode).json({
    error: message,
    ...(isProduction ? {} : { details: err instanceof AppError ? undefined : err.message })
  });
}
