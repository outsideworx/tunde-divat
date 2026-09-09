import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
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

function fieldLabel(path: string) {
  const labels: Record<string, string> = {
    username: "Felhasználónév",
    password: "Jelszó",
    invite_code: "Meghívókód",
    privacy_accepted: "Adatkezelési tájékoztató elfogadása",
    last_name: "Vezetéknév",
    first_name: "Keresztnév",
    phone: "Telefonszám",
    product_id: "Product ID",
    product_name: "Termék megnevezése",
    price: "Ár",
    available_sizes: "Méretek",
    size_quantities: "Méret maximumok",
    category: "Kategória",
    description: "Leírás",
    reservable_until: "Foglalható eddig",
    reservable_duration_hours: "Foglalási időtartam",
    size: "Méret",
    quantity: "Darabszám",
    pickup_id: "Átvételi időpont",
    status: "Státusz",
    address: "Átvételi hely",
    start_at: "Átvétel kezdete",
    end_at: "Átvétel vége"
  };
  return labels[path] ?? path;
}

function friendlyValidationMessage(err: ZodError) {
  const issue = err.issues[0];
  if (!issue) return "Hibás vagy hiányos adatok.";
  const field = issue.path.join(".");
  const label = fieldLabel(field);
  if (field === "price") return "Az ár megadása kötelező, és nullánál nagyobb szám legyen.";
  if (field === "available_sizes") return "Legalább egy méretet válassz ki.";
  if (field === "product_name") return "A termék megnevezése kötelező.";
  if (field === "username") return "A felhasználónév megadása kötelező, legalább 3 karakter legyen, és csak betűt, számot, pontot, kötőjelet vagy aláhúzást tartalmazhat.";
  if (field === "password") return "A jelszó megadása kötelező, legalább 6 karakter legyen.";
  if (field === "invite_code") return "A meghívókód megadása kötelező.";
  if (field === "phone") return "A telefonszám formátuma nem megfelelő.";
  if (field === "privacy_accepted") return "Az adatkezelési tájékoztató elfogadása kötelező.";
  if (issue.code === "invalid_type") return `${label}: kötelező vagy nem megfelelő formátumú mező.`;
  if (issue.code === "too_small") return `${label}: a megadott érték túl rövid vagy túl kicsi.`;
  if (issue.code === "too_big") return `${label}: a megadott érték túl hosszú vagy túl nagy.`;
  if (issue.code === "invalid_enum_value") return `${label}: nem választható érték.`;
  if (issue.code === "invalid_string") return `${label}: nem megfelelő formátum.`;
  return `${label}: ${issue.message}`;
}

function prismaErrorCode(err: Error) {
  if (typeof err !== "object" || !err || !("code" in err)) return "";
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const prismaCode = prismaErrorCode(err);
  const isDatabaseConnectionError =
    err.name === "PrismaClientInitializationError" ||
    err.message.includes("Can't reach database server") ||
    err.message.includes("Database server") ||
    err.message.includes("P1001");
  const isValidationError = err instanceof ZodError;
  const statusCode =
    err instanceof AppError
      ? err.statusCode
      : isValidationError
        ? 400
      : prismaCode === "P2002"
        ? 409
      : prismaCode === "P2025"
        ? 404
      : isDatabaseConnectionError
        ? 503
        : 500;
  const message =
    err instanceof AppError
      ? err.message
      : isValidationError
        ? friendlyValidationMessage(err)
      : prismaCode === "P2002"
        ? "Ez az adat már létezik, kérlek adj meg másik értéket."
      : prismaCode === "P2025"
        ? "A keresett adat nem található."
      : isDatabaseConnectionError
        ? "Az adatbázis nem elérhető. Ellenőrizd a SQLite adatbázisfájlt, majd futtasd az inicializálást és a teszt felhasználók seedelését."
        : "Váratlan szerverhiba történt. Kérlek próbáld újra.";
  if (!(err instanceof AppError) && !isValidationError) {
    logger.error("request_error", {
      method: _req.method,
      path: _req.path,
      statusCode,
      name: err.name,
      message: err.message
    });
  }
  res.status(statusCode).json({
    error: message,
    ...(isProduction ? {} : { details: err instanceof AppError || isValidationError ? undefined : err.message })
  });
}
