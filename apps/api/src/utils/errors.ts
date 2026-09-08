import type { NextFunction, Request, Response } from "express";
import { isProduction } from "../config/env.js";
import { logger } from "./securityLog.js";

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

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
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
        ? "Az adatbázis nem elérhető. Ellenőrizd a SQLite adatbázisfájlt, majd futtasd az inicializálást és a teszt felhasználók seedelését."
        : "Internal server error";
  if (!(err instanceof AppError)) {
    logger.error("request_error", {
      method: req.method,
      path: req.path,
      statusCode,
      name: err.name,
      message: err.message
    });
  }
  res.status(statusCode).json({
    error: message,
    ...(isProduction ? {} : { details: err instanceof AppError ? undefined : err.message })
  });
}
