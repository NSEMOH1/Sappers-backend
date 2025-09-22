import { Role } from "@prisma/client";
import { requireRoles } from "../middleware/requireRoles";
import { AuthenticatedRequest } from "../types";
import { Response, NextFunction } from "express";
import { Router } from "express";
import {
    getAllTerminations,
    requestTermination,
} from "../services/terminationService";

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
            const { reason } = req.body;
            const memberId = req.user?.id;
            if (!memberId) {
                res.status(401).json({
                    error: "Member not authenticated",
                });
                return;
            }
            const request = await requestTermination({ reason, memberId });
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

router.get(
    "/",
    requireRoles([Role.ADMIN]),
    async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const request = await getAllTerminations();
            res.json({
                success: true,
                ...request,
            });
        } catch (error) {
            next(error);
        }
    }
);

export { router as terminationRoutes };
