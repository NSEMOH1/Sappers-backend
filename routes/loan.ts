import { Router, Response, NextFunction } from "express";
import {
  applyForLoan,
  approveLoan,
  confirmLoanWithOTP,
  getActiveLoanCategory,
  getAdminLoanStatistics,
  getAllLoans,
  getMemberLoanBalance,
  getMemberLoanHistory,
  rejectLoan,
} from "../services/loanService";
import { AuthenticatedRequest } from "../types";
import { requireRoles } from "../middleware/requireRoles";
import { Role } from "@prisma/client";
// import {
//     notifyLoanApplication,
//     notifyLoanStatus,
// } from "../services/notificationService";

const router = Router();

router.post(
  "/apply",
  requireRoles([Role.MEMBER]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const memberId = req.user?.id;

      if (!memberId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const result = await applyForLoan({
        ...req.body,
        memberId,
      });

      // await notifyLoanApplication(
      //     memberId,
      //     result.loanId,
      //     req.body.amount,
      //     req.body.categoryName
      // );
      res.status(201).json({
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/",
  requireRoles([Role.ADMIN]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getAllLoans();

      res.status(201).json({
        result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/admin-stats",
  requireRoles([Role.ADMIN]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const adminStats = await getAdminLoanStatistics();

      res.status(200).json({
        success: true,
        data: adminStats,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/verify",
  requireRoles([Role.MEMBER]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id: loanId } = req.params;
      const memberId = req.user?.id;
      const { otp } = req.body;

      if (!memberId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const result = await confirmLoanWithOTP(loanId, otp, memberId);

      res.json({
        success: true,
        message: "Loan application verified",
        data: result,
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
      const { id: loanId } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin not authenticated",
        });
        return;
      }

      const result = await approveLoan({ loanId }, adminId);

      if (!result.loan?.memberId) {
        res.status(401).json({
          success: false,
          message: "No member found",
        });
        return;
      }

    //   await notifyLoanStatus(
    //     result.loan?.memberId,
    //     loanId,
    //     "APPROVED",
    //     adminId,
    //     result.loan?.approvedAmount,
    //     result.loan?.categoryId
    //   );

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error,
        });
        return;
      }

      res.json({
        success: true,
        message: "Loan approved successfully",
        data: result.loan,
        transaction: result.transaction,
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
      const { id: loanId } = req.params;
      const { rejectionReason } = req.body;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: "Admin not authenticated",
        });
        return;
      }

      const result = await rejectLoan(
        {
          loanId,
          rejectionReason,
        },
        adminId
      );

      if (!result.loan?.memberId) {
        res.status(401).json({
          success: false,
          message: "No member found",
        });
        return;
      }

    //   await notifyLoanStatus(
    //     result.loan.memberId,
    //     loanId,
    //     "REJECTED",
    //     adminId,
    //     result.loan.amount,
    //     result.loan.categoryId
    //   );

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error,
        });
        return;
      }

      res.json({
        success: true,
        message: "Loan rejected successfully",
        data: result.loan,
        transaction: result.transaction,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/balances",
  requireRoles([Role.MEMBER]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const memberId = req.user?.id;

      if (!memberId) {
        res.status(401).json({
          success: false,
          error: "User not authenticated",
        });
        return;
      }

      const balances = await getMemberLoanBalance(memberId);

      res.json({
        success: true,
        ...balances,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/history",
  requireRoles([Role.MEMBER]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const memberId = req.user?.id;

      if (!memberId) {
        res.status(401).json({
          success: false,
          error: "User not authenticated",
        });
        return;
      }

      const balances = await getMemberLoanHistory(memberId);

      res.json({
        success: true,
        balances: balances,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/categories",
  requireRoles([Role.MEMBER]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const memberId = req.user?.id;

      if (!memberId) {
        res.status(401).json({
          success: false,
          error: "Member not authenticated",
        });
        return;
      }

      const categories = await getActiveLoanCategory();

      res.json({
        success: true,
        ...categories,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as loanRoutes };
