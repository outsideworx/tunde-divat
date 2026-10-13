import { Router } from "express";

export const metricsRoutes = Router();

metricsRoutes.get("/", (_req, res) => {
  res.status(200).type("text/plain; version=0.0.4; charset=utf-8").send("up 1\n");
});
