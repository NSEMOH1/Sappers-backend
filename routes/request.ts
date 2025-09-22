import { Router } from "express";
import { AuthenticatedRequest } from "../types";
import { Response, NextFunction } from "express";
import { requireRoles } from "../middleware/requireRoles";
import { Role } from "@prisma/client";
import {
  approveRequest,
  getAllRequests,
  rejectRequest,
  sendRequest,
} from "../services/requestService";

const router = Router();

router.post(
  "/",
  requireRoles([Role.MEMBER]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { reason, amount } = req.body;
      const memberId = req.user?.id;
      if (!memberId) {
        res.status(401).json({
          error: "Member not authenticated",
        });
        return;
      }
      const request = await sendRequest({ reason, amount, memberId });
      res.json({
        success: true,
        message: "Request Sent Successfully",
        ...request,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/approve",
  requireRoles([Role.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: requestId } = req.params;
      if (!requestId) {
        res.status(401).json({
          error: "Request ID is required",
        });
        return;
      }
      const request = await approveRequest({ requestId });
      res.json({
        ...request,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/reject",
  requireRoles([Role.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: requestId } = req.params;
      if (!requestId) {
        res.status(401).json({
          error: "Request ID is required",
        });
        return;
      }
      const request = await rejectRequest({ requestId });
      res.json({
        ...request,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/",
  requireRoles([Role.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;
      const request = await getAllRequests(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json({
        ...request,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as requestRoutes };
