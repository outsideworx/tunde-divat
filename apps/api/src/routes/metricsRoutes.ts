import { Router } from "express";

export const metricsRoutes = Router();

metricsRoutes.get("/metrics", (_req, res) => {
  res.status(200).send("up 1");
});
