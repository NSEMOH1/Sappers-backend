import { Router } from "express";
import { prisma } from "../config/database";
import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types";
import { requireRoles } from "../middleware/requireRoles";
import { Role } from "@prisma/client";

const router = Router();

router.get(
  "/financial",
  requireRoles([Role.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const report = await prisma.transaction.findMany({
        where: { status: "COMPLETED" },
        include: {
          member: {
            select: {
              first_name: true,
              last_name: true,
              service_number: true,
              phone: true,
              bank: {
                select: {
                  account_number: true,
                },
              },
            },
          },
          loan: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const formatted = report.map((tx) => {
        const transactionType = tx.loan ? "Loan" : "Savings";

        return {
          fullName: `${tx.member?.first_name ?? ""} ${
            tx.member?.last_name ?? ""
          }`,
          serviceNumber: tx.member?.service_number ?? "-",
          accountNo: tx.member?.bank[0]?.account_number ?? "-",
          debit:
            tx.type.includes("WITHDRAWAL") || tx.type.includes("FEE")
              ? `₦${tx.amount.toFixed(2)}`
              : "-",
          credit:
            tx.type.includes("DEPOSIT") || tx.type.includes("DISBURSEMENT")
              ? `₦${tx.amount.toFixed(2)}`
              : "-",
          date: tx.createdAt.toISOString().split("T")[0],
          status: tx.status,
          type: transactionType,
          amount: `₦${tx.amount.toFixed(2)}`,
        };
      });

      res.json(formatted);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/monthly-deductions",
  requireRoles([Role.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const members = await prisma.member.findMany({
        select: {
          first_name: true,
          last_name: true,
          service_number: true,
          phone: true,
          monthlyDeduction: true,
          status: true,
          bank: {
            select: {
              account_number: true,
            },
          },
        },
      });

      const result = members.map((m) => ({
        fullName: `${m.first_name} ${m.last_name}`,
        serviceNumber: m.service_number,
        accountNo: m.bank[0]?.account_number || "-",
        deduction: `₦${m.monthlyDeduction.toFixed(2)}`,
        status: m.status,
      }));

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/loan-repayments",
  requireRoles([Role.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const repayments = await prisma.repayment.findMany({
        include: {
          loan: {
            include: {
              member: true,
            },
          },
        },
      });

      const data = repayments.map((r) => ({
        fullName: `${r.loan.member.first_name} ${r.loan.member.last_name}`,
        serviceNumber: r.loan.member.service_number,
        amount: `₦${r.amount.toFixed(2)}`,
        dueDate: r.dueDate.toISOString().split("T")[0],
        paidAt: r.paidAt ? r.paidAt.toISOString().split("T")[0] : "Not Paid",
        status: r.status,
      }));

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/dividends",
  requireRoles([Role.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const dividends = await prisma.transaction.findMany({
        where: {
          type: "ADJUSTMENT",
          description: {
            contains: "dividend",
            mode: "insensitive",
          },
        },
        include: {
          member: true,
        },
      });

      const data = dividends.map((d) => ({
        fullName: `${d.member?.first_name ?? ""} ${d.member?.last_name ?? ""}`,
        serviceNumber: d.member?.service_number,
        accountNo: d.member?.phone,
        amount: `₦${d.amount.toFixed(2)}`,
        status: d.status,
      }));

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/interests",
  requireRoles([Role.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const interestTx = await prisma.transaction.findMany({
        where: {
          description: {
            contains: "interest",
            mode: "insensitive",
          },
        },
        include: {
          member: true,
        },
      });

      const data = interestTx.map((tx) => ({
        fullName: `${tx.member?.first_name ?? ""} ${
          tx.member?.last_name ?? ""
        }`,
        serviceNumber: tx.member?.service_number,
        accountNo: tx.member?.phone,
        amount: `₦${tx.amount.toFixed(2)}`,
        type: tx.type,
        status: tx.status,
      }));

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

export { router as adminReportRoutes };
