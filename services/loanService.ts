import { LoanStatus, RepaymentStatus, TransactionType } from "@prisma/client";
import { prisma } from "../config/database";
import { LoanBalance, MemberLoanHistory } from "../types";
import Decimal from "decimal.js";
import { verifyOTP } from "../utils/functions";

export const confirmLoanWithOTP = async (
  loanId: string,
  otp: string,
  memberId: string
) => {
  const isValid = await verifyOTP(loanId, otp);
  if (!isValid) {
    throw new Error("Invalid or expired OTP");
  }

  return await prisma.$transaction(async (tx) => {
    const existingTransaction = await tx.transaction.findFirst({
      where: {
        loanId,
        type: "PENDING",
        status: "PENDING",
      },
    });

    if (existingTransaction) {
      throw new Error("Loan confirmation already in progress");
    }

    const updatedLoan = await tx.loan.update({
      where: { id: loanId, memberId },
      data: {
        status: LoanStatus.PENDING,
        otp: null,
        otpExpiresAt: null,
      },
    });

    await tx.transaction.create({
      data: {
        loanId,
        type: "PENDING",
        amount: updatedLoan.amount,
        status: "PENDING",
        description: "Loan application verified via OTP",
        memberId,
      },
    });

    return updatedLoan;
  });
};
export const approveLoan = async (
  data: { loanId: string },
  adminId: string
) => {
  try {
    const existingLoan = await prisma.loan.findUnique({
      where: { id: data.loanId },
    });

    if (!existingLoan) {
      throw new Error("Loan not found");
    }

    if (existingLoan.status !== LoanStatus.PENDING) {
      throw new Error("Only pending loans can be approved");
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedLoan = await tx.loan.update({
        where: { id: data.loanId },
        data: {
          status: LoanStatus.APPROVED,
          approvedAmount: existingLoan.amount,
          updatedAt: new Date(),
          approvedById: adminId,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          loanId: data.loanId,
          type: TransactionType.LOAN_APPROVED,
          amount: existingLoan.amount,
          status: "COMPLETED",
          description: `Loan approved by admin`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return { updatedLoan, transaction };
    });

    return {
      success: true,
      loan: result.updatedLoan,
      transaction: result.transaction,
      message: "Loan approved successfully",
    };
  } catch (error) {
    console.error("Error approving loan:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

export const rejectLoan = async (
  data: {
    loanId: string;
    rejectionReason?: string;
  },
  adminId: string
) => {
  try {
    const existingLoan = await prisma.loan.findUnique({
      where: { id: data.loanId },
    });

    if (!existingLoan) {
      throw new Error("Loan not found");
    }

    if (existingLoan.status !== LoanStatus.PENDING) {
      throw new Error("Only pending loans can be rejected");
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedLoan = await tx.loan.update({
        where: { id: data.loanId },
        data: {
          status: LoanStatus.REJECTED,
          updatedAt: new Date(),
          rejectedById: adminId,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          loanId: data.loanId,
          type: TransactionType.LOAN_REJECTED,
          amount: existingLoan.amount,
          status: "COMPLETED",
          description: `Loan rejected: ${
            data.rejectionReason || "No reason provided"
          }`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return { updatedLoan, transaction };
    });

    return {
      success: true,
      loan: result.updatedLoan,
      transaction: result.transaction,
      message: "Loan rejected successfully",
    };
  } catch (error) {
    console.error("Error rejecting loan:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

export const getMemberLoanBalance = async (memberId: string) => {
  const categories = await prisma.loanCategory.findMany({
    select: {
      id: true,
      name: true,
      maxAmount: true,
    },
  });

  const loans = await prisma.loan.findMany({
    where: { memberId },
    include: {
      category: {
        select: { name: true },
      },
      repayments: {
        select: {
          amount: true,
          dueDate: true,
          status: true,
          paidAt: true,
        },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const loanBalances: LoanBalance[] = loans.map((loan) => {
    const paidRepayments = loan.repayments.filter(
      (r) => r.status === RepaymentStatus.PAID
    );
    const pendingRepayments = loan.repayments.filter(
      (r) => r.status === RepaymentStatus.PENDING
    );

    const totalPaid = paidRepayments.reduce(
      (sum, repayment) => sum + repayment.amount.toNumber(),
      0
    );

    const outstandingBalance = Math.max(
      0,
      loan.approvedAmount.toNumber() - totalPaid
    );

    const totalRepayments = loan.repayments.length;
    const paidCount = paidRepayments.length;
    const percentagePaid =
      totalRepayments > 0 ? Math.round((paidCount / totalRepayments) * 100) : 0;

    return {
      loanId: loan.id,
      category: loan.category.name,
      reference: loan.reference,
      originalAmount: loan.amount.toNumber(),
      approvedAmount: loan.approvedAmount.toNumber(),
      interestRate: loan.interestRate,
      durationMonths: loan.durationMonths,
      totalPaid,
      outstandingBalance,
      status: loan.status,
      startDate: loan.startDate?.toISOString(),
      endDate: loan.endDate?.toISOString(),
      nextPayment:
        pendingRepayments.length > 0
          ? {
              dueDate: pendingRepayments[0].dueDate.toISOString(),
              amount: pendingRepayments[0].amount.toNumber(),
            }
          : undefined,
      repaymentProgress: {
        paid: paidCount,
        remaining: totalRepayments - paidCount,
        percentage: percentagePaid,
      },
    };
  });

  const categoryTotals = await prisma.loan.groupBy({
    by: ["categoryId"],
    _sum: { amount: true },
    where: {
      memberId,
      status: LoanStatus.DISBURSED,
    },
  });

  const categorySummary = categories.map((category) => {
    const categoryTotal = categoryTotals.find(
      (ct) => ct.categoryId === category.id
    );
    const collectedAmount = categoryTotal?._sum.amount?.toNumber() || 0;
    const maxAmount = category.maxAmount?.toNumber() || 0;
    const remainingAmount = Math.max(0, maxAmount - collectedAmount);

    return {
      categoryId: category.id,
      categoryName: category.name,
      maxAmount,
      collectedAmount,
      remainingAmount,
      percentageCollected:
        maxAmount > 0 ? Math.round((collectedAmount / maxAmount) * 100) : 0,
    };
  });

  const summary = {
    totalOutstanding: loanBalances.reduce(
      (sum, loan) =>
        sum + (loan.outstandingBalance > 0 ? loan.outstandingBalance : 0),
      0
    ),
    totalPaid: loanBalances.reduce((sum, loan) => sum + loan.totalPaid, 0),
    activeLoans: loanBalances.filter(
      (loan) => loan.status === LoanStatus.ACTIVE
    ).length,
    completedLoans: loanBalances.filter(
      (loan) => loan.status === LoanStatus.COMPLETED
    ).length,
    defaultedLoans: loanBalances.filter(
      (loan) => loan.status === LoanStatus.DEFAULTED
    ).length,
  };

  return {
    data: {
      loans: loanBalances,
      summary,
      categories: categorySummary,
    },
  };
};

export const getAllLoans = () => {
  const loans = prisma.loan.findMany({
    select: {
      id: true,
      category: {
        select: {
          name: true,
        },
      },
      amount: true,
      approvedAmount: true,
      status: true,
      interestRate: true,
      durationMonths: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      reference: true,
      member: {
        select: {
          first_name: true,
          last_name: true,
          service_number: true,
          bank: {
            select: {
              account_number: true,
            },
          },
        },
      },
      repayments: {
        select: {
          dueDate: true,
          amount: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          full_name: true,
          email: true,
        },
      },
      rejectedBy: {
        select: {
          id: true,
          full_name: true,
          email: true,
        },
      },
    },
  });

  if (!loans) {
    return "There are no loans at the moment";
  }

  return loans;
};

export const getAdminLoanStatistics = async () => {
  const admins = await prisma.user.findMany({
    select: {
      id: true,
      full_name: true,
      email: true,
    },
  });

  const adminStats = await Promise.all(
    admins.map(async (admin) => {
      const approvedCount = await prisma.loan.count({
        where: {
          approvedById: admin.id,
        },
      });

      const rejectedCount = await prisma.loan.count({
        where: {
          rejectedById: admin.id,
        },
      });

      const disbursedCount = await prisma.loan.count({
        where: {
          approvedById: admin.id,
          status: "DISBURSED",
        },
      });

      const pendingCount = await prisma.loan.count({
        where: {
          approvedById: admin.id,
          status: "PENDING",
        },
      });

      return {
        ...admin,
        approvedCount,
        rejectedCount,
        disbursedCount,
        pendingCount,
        totalActions: approvedCount + rejectedCount,
      };
    })
  );

  return adminStats;
};

export const getMemberLoanHistory = async (
  memberId: string
): Promise<MemberLoanHistory[]> => {
  return await prisma.$transaction(async (tx) => {
    const loans = await tx.loan.findMany({
      where: { memberId },
      include: {
        category: {
          select: { name: true },
        },
        repayments: {
          orderBy: { dueDate: "asc" },
          select: {
            dueDate: true,
            amount: true,
            status: true,
            paidAt: true,
          },
        },
        transactions: {
          where: {
            type: {
              in: [
                TransactionType.LOAN_DISBURSEMENT,
                TransactionType.LOAN_REPAYMENT,
                TransactionType.LOAN_REJECTED,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            amount: true,
            createdAt: true,
            status: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!loans || loans.length === 0) {
      return [];
    }

    return loans.map((loan) => {
      const paidRepayments = loan.repayments.filter((r) => r.status === "PAID");
      const pendingRepayments = loan.repayments.filter(
        (r) => r.status === "PENDING"
      );

      const totalRepaid = paidRepayments
        .reduce((sum, repayment) => sum.plus(repayment.amount), new Decimal(0))
        .toNumber();

      const outstandingBalance = Math.max(
        0,
        loan.approvedAmount.toNumber() - totalRepaid
      );

      return {
        id: loan.id,
        reference: loan.reference,
        category: loan.category.name,
        appliedAmount: loan.amount.toNumber(),
        approvedAmount: loan.approvedAmount.toNumber(),
        interestRate: loan.interestRate,
        durationMonths: loan.durationMonths,
        status: loan.status,
        applicationDate: loan.createdAt,
        approvalDate: loan.startDate,
        completionDate: loan.endDate,
        totalRepaid,
        outstandingBalance,
        nextPaymentDue:
          pendingRepayments.length > 0
            ? {
                date: pendingRepayments[0].dueDate,
                amount: pendingRepayments[0].amount.toNumber(),
              }
            : undefined,
        repayments: loan.repayments.map((repayment) => ({
          dueDate: repayment.dueDate,
          amount: repayment.amount.toNumber(),
          status: repayment.status,
          paidDate: repayment.paidAt,
        })),
        transactions: loan.transactions.map((transaction) => ({
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount.toNumber(),
          date: transaction.createdAt,
          status: transaction.status,
          description: transaction.description,
        })),
      };
    });
  });
};
