import { Response, NextFunction, Router } from "express";
import {
  AuthenticatedRequest,
  createSavings,
  IWithdrawSavings,
} from "../types";
import { requireRoles } from "../middleware/requireRoles";
import { Rank, Role } from "@prisma/client";
import {
  addSavings,
  editDeduction,
  getAllSavings,
  getMemberTotalSavings,
  getSavingsBalance,
  uploadCooperativeSavingsFromExcel,
  withdrawSavings,
} from "../services/savingService";
// import {
//   notifySavingsDeposit,
//   notifyTransaction,
// } from "../services/notificationService";
import { prisma } from "../config/database";
import { calculateProcessingTime } from "../utils/functions";
import multer from "multer";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.includes("excel") ||
      file.mimetype.includes("spreadsheet")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed"));
    }
  },
});

router.post(
  "/deposit",
  requireRoles([Role.MEMBER]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const savingsData: createSavings = req.body;
      const memberId = req.user?.id;

      if (!memberId) {
        res.status(401).json({
          error: "User not authenticated",
        });
        return;
      }
      const data = await addSavings({
        ...savingsData,
        memberId: memberId,
      });

    //   await notifySavingsDeposit(
    //     memberId,
    //     data.id,
    //     savingsData.amount.toString(),
    //     savingsData.category_name
    //   );

    //   await notifyTransaction(
    //     memberId,
    //     data.id,
    //     savingsData.amount.toString(),
    //     "SAVINGS_DEPOSIT",
    //     `${savingsData.category_name} savings deposit`
    //   );

      res.status(201).json({
        success: true,
        data: data,
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
          error: "User not authenticated",
        });
        return;
      }
      const balance = await getSavingsBalance(memberId);
      res.json({
        success: true,
        data: balance,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/withdraw",
  requireRoles([Role.MEMBER]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const savingsData: IWithdrawSavings = req.body;
      const memberId = req.user?.id;

      if (!memberId) {
        res.status(401).json({
          error: "Member not authenticated",
        });
        return;
      }
      const data = await withdrawSavings({
        ...savingsData,
        memberId: memberId,
      });

    //   await notifyTransaction(
    //     memberId,
    //     data.id,
    //     savingsData.amount.toString(),
    //     "SAVINGS_WITHDRAWAL",
    //     `${savingsData.category_name} savings withdrawal`
    //   );

      res.status(201).json({
        success: true,
        data: data,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/deduction",
  requireRoles([Role.MEMBER]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { amount } = req.body;
      const memberId = req.user?.id;

      if (!memberId) {
        res.status(401).json({
          error: "Member not authenticated",
        });
        return;
      }
      const data = await editDeduction(amount, memberId);

      res.status(201).json({
        success: true,
        data: data,
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
      const data = await getAllSavings();

      res.status(201).json({
        success: true,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/total-savings",
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
          error: "Member not authenticated",
        });
        return;
      }
      const data = await getMemberTotalSavings(memberId);

      res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/upload/cooperative-savings",
  requireRoles([Role.ADMIN]),
  upload.single("file"),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
        return;
      }

      console.log(req.file);
      if (!req.file.buffer || req.file.buffer.length === 0) {
        res.status(400).json({
          success: false,
          error: "Uploaded file is empty",
        });
        return;
      }
      const isExcel = req.file.buffer.subarray(0, 2).toString() === "PK";
      if (!isExcel) {
        res.status(400).json({
          success: false,
          error: "File is not a valid Excel format",
        });
        return;
      }

      const uploadType = req.body.uploadType || "MONTHLY DEDUCTIONS";
      const uploadedBy = req.user?.id;

      const result = await uploadCooperativeSavingsFromExcel(
        req.file.buffer,
        uploadedBy
      );

      await prisma.uploadLog.create({
        data: {
          fileName: req.file.originalname,
          uploadType: uploadType,
          processedItems: result.processedCount,
          failedItems: result.errorCount,
          totalAmount: result.summary.totalAmount,
          status: result.success ? "COMPLETED" : "FAILED",
          uploadedById: uploadedBy,
          processingTime: new Date(),
          errors:
            result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        },
      });

      res.json({
        success: result.success,
        processedCount: result.processedCount,
        errorCount: result.errorCount,
        summary: result.summary,
        errors: result.errors,
        message: result.success
          ? `Successfully processed ${result.processedCount} records`
          : `Upload completed with ${result.errorCount} errors`,
      });
    } catch (error) {
      console.error("Upload error:", error);

      if (req.file && req.user?.id) {
        try {
          await prisma.uploadLog.create({
            data: {
              fileName: req.file.originalname,
              uploadType: req.body.uploadType || "MONTHLY DEDUCTIONS",
              processedItems: 0,
              failedItems: 0,
              totalAmount: 0,
              status: "FAILED",
              uploadedById: req.user.id,
              processingTime: new Date(),
              errors: JSON.stringify([
                {
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                },
              ]),
            },
          });
        } catch (logError) {
          console.error("Failed to log upload error:", logError);
        }
      }

      next(error);
    }
  }
);

router.get(
  "/logs",
  requireRoles([Role.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { page = 1, limit = 10, startDate, endDate } = req.query;

      const where: any = {};

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        };
      }

      const [logs, total] = await Promise.all([
        prisma.uploadLog.findMany({
          where,
          include: {
            uploadedBy: {
              select: {
                id: true,
                full_name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        prisma.uploadLog.count({ where }),
      ]);

      const formattedLogs = logs.map((log: any) => ({
        id: log.id,
        fileName: log.fileName,
        uploadType: log.uploadType,
        processedTime: log.processingTime
          ? calculateProcessingTime(log.createdAt, log.processingTime)
          : "N/A",
        processedItems: log.processedItems,
        failedItems: log.failedItems,
        totalAmount: log.totalAmount,
        status: log.status,
        date: log.createdAt,
        uploadedBy: log.uploadedBy
          ? {
              id: log.uploadedBy.id,
              name: log.uploadedBy.full_name,
              email: log.uploadedBy.email,
            }
          : null,
        errors: log.errors ? JSON.parse(log.errors) : [],
      }));

      res.json({
        success: true,
        data: formattedLogs,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/logs/:id",
  requireRoles([Role.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const log = await prisma.uploadLog.findUnique({
        where: { id },
        include: {
          uploadedBy: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
      });

      if (!log) {
        res.status(404).json({
          success: false,
          error: "Upload log not found",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ...log,
          errors: log.errors ? JSON.parse(log.errors) : [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as savingsRoutes };
