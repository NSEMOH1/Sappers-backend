import { prisma } from "../config/database";
import NodeCache from "node-cache";
import { getMemberTotalSavings } from "./savingService";

const reportCache = new NodeCache({ stdTTL: 3600 });

const getCacheKey = (reportName: string, params: Record<string, any>) => {
  return `${reportName}:${JSON.stringify(params)}`;
};

export const generateFinancialReport = async (
  startDate: Date,
  endDate: Date,
  includeMemberDetails = false
) => {
  const cacheKey = getCacheKey("financialReport", {
    startDate,
    endDate,
    includeMemberDetails,
  });
  const cachedReport = reportCache.get(cacheKey);
  if (cachedReport) return cachedReport;

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      member: includeMemberDetails
        ? {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              service_number: true,
            },
          }
        : false,
    },
  });

  const income = transactions
    .filter((t) =>
      ["LOAN_REPAYMENT", "SAVINGS_DEPOSIT", "FEE"].includes(t.type)
    )
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expenses = transactions
    .filter((t) => ["LOAN_DISBURSEMENT", "SAVINGS_WITHDRAWAL"].includes(t.type))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const breakdown = {
    loanInterest: transactions
      .filter((t) => t.type === "LOAN_REPAYMENT")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    fees: transactions
      .filter((t) => t.type === "FEE")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    savingsDeposits: transactions
      .filter((t) => t.type === "SAVINGS_DEPOSIT")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    loanDisbursements: transactions
      .filter((t) => t.type === "LOAN_DISBURSEMENT")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    savingsWithdrawals: transactions
      .filter((t) => t.type === "SAVINGS_WITHDRAWAL")
      .reduce((sum, t) => sum + Number(t.amount), 0),
  };

  const memberDetails = includeMemberDetails
    ? transactions
        .filter((t) => t.member)
        .map((t) => ({
          transactionId: t.id,
          type: t.type,
          amount: Number(t.amount),
          date: t.createdAt,
          reference: t.reference,
          status: t.status,
          member: {
            id: t.member!.id,
            name: `${t.member!.first_name} ${t.member!.last_name}`,
            serviceNumber: t.member!.service_number,
          },
        }))
    : undefined;

  const memberSummary = includeMemberDetails
    ? transactions
        .filter((t) => t.member)
        .reduce((acc, t) => {
          const memberId = t.member!.id;
          const memberName = `${t.member!.first_name} ${t.member!.last_name}`;

          if (!acc[memberId]) {
            acc[memberId] = {
              id: memberId,
              name: memberName,
              serviceNumber: t.member!.service_number,
              totalTransactions: 0,
              totalAmount: 0,
              transactionTypes: {},
              loanTransactions: 0,
              savingsTransactions: 0,
            };
          }

          acc[memberId].totalTransactions++;
          acc[memberId].totalAmount += Number(t.amount);

          if (!acc[memberId].transactionTypes[t.type]) {
            acc[memberId].transactionTypes[t.type] = 0;
          }
          acc[memberId].transactionTypes[t.type]++;

          return acc;
        }, {} as Record<string, any>)
    : undefined;

  const report = {
    period: { start: startDate, end: endDate },
    totals: {
      income,
      expenses,
      netProfit: income - expenses,
    },
    breakdown,
    ...(includeMemberDetails && {
      transactions: memberDetails,
      memberSummary: Object.values(memberSummary || {}),
    }),
  };

  reportCache.set(cacheKey, report);
  return report;
};

export const generateLoanRepaymentReport = async (
  startDate: Date,
  endDate: Date,
  includeMemberDetails = false
) => {
  const cacheKey = getCacheKey("loanRepaymentReport", {
    startDate,
    endDate,
    includeMemberDetails,
  });
  const cachedReport = reportCache.get(cacheKey);
  if (cachedReport) return cachedReport;

  const repayments = await prisma.repayment.findMany({
    where: {
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      loan: {
        include: {
          category: true,
          member: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              service_number: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  const totalDue = repayments.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPaid = repayments
    .filter((r) => r.status === "PAID")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const totalOverdue = repayments
    .filter((r) => r.status === "LATE" || r.status === "DEFAULTED")
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const byLoanType = Object.entries(
    repayments.reduce((acc, r) => {
      const type = r.loan.category.name;
      acc[type] = acc[type] || { due: 0, paid: 0, overdue: 0 };
      acc[type].due += Number(r.amount);
      if (r.status === "PAID") acc[type].paid += Number(r.amount);
      if (r.status === "LATE" || r.status === "DEFAULTED")
        acc[type].overdue += Number(r.amount);
      return acc;
    }, {} as Record<string, { due: number; paid: number; overdue: number }>)
  ).map(([name, stats]) => ({ name, ...stats }));

  const memberDetails = includeMemberDetails
    ? repayments.map((r) => ({
        repaymentId: r.id,
        amount: Number(r.amount),
        dueDate: r.dueDate,
        status: r.status,
        paidAt: r.paidAt,
        loan: {
          id: r.loan.id,
          reference: r.loan.reference,
          category: r.loan.category.name,
          totalAmount: Number(r.loan.amount),
          approvedAmount: Number(r.loan.approvedAmount),
          interestRate: r.loan.interestRate,
          durationMonths: r.loan.durationMonths,
        },
        member: {
          id: r.loan.member.id,
          name: `${r.loan.member.first_name} ${r.loan.member.last_name}`,
          serviceNumber: r.loan.member.service_number,
          email: r.loan.member.email,
          phone: r.loan.member.phone,
        },
      }))
    : undefined;

  const report = {
    period: { start: startDate, end: endDate },
    summary: {
      totalDue,
      totalPaid,
      totalOverdue,
      collectionRate: totalDue > 0 ? (totalPaid / totalDue) * 100 : 0,
    },
    breakdown: {
      byLoanType,
    },
    ...(includeMemberDetails && { repayments: memberDetails }),
  };

  reportCache.set(cacheKey, report);
  return report;
};
export const generateMemberFinancialSummary = async (
  memberId: string,
  startDate?: Date,
  endDate?: Date
) => {
  const cacheKey = getCacheKey("memberFinancialSummary", {
    memberId,
    startDate,
    endDate,
  });
  const cachedReport = reportCache.get(cacheKey);
  if (cachedReport) return cachedReport;

  const whereClause: any = { memberId };
  if (startDate && endDate) {
    whereClause.createdAt = {
      gte: startDate,
      lte: endDate,
    };
  }

  const [member, transactions, loans, savings] = await Promise.all([
    prisma.member.findUnique({
      where: { id: memberId },
    }),
    prisma.transaction.findMany({
      where: whereClause,
      include: {
        loan: {
          include: {
            category: true,
          },
        },
        saving: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.loan.findMany({
      where: { memberId },
      include: {
        category: true,
        repayments: true,
      },
    }),
    prisma.saving.findMany({
      where: { memberId },
      include: {
        category: true,
      },
    }),
  ]);

  if (!member) {
    throw new Error("Member not found");
  }

  const transactionSummary = {
    totalTransactions: transactions.length,
    totalAmount: transactions.reduce((sum, t) => sum + Number(t.amount), 0),
    byType: transactions.reduce((acc, t) => {
      acc[t.type] = acc[t.type] || { count: 0, amount: 0 };
      acc[t.type].count++;
      acc[t.type].amount += Number(t.amount);
      return acc;
    }, {} as Record<string, { count: number; amount: number }>),
  };

  const loanSummary = {
    totalLoans: loans.length,
    activeLoans: loans.filter((l) => l.status === "ACTIVE").length,
    totalBorrowed: loans.reduce((sum, l) => sum + Number(l.approvedAmount), 0),
    totalRepaid: loans.reduce(
      (sum, l) =>
        sum +
        l.repayments.reduce(
          (repSum, r) =>
            r.status === "PAID" ? repSum + Number(r.amount) : repSum,
          0
        ),
      0
    ),
    byCategory: loans.reduce((acc, l) => {
      acc[l.category.name] = acc[l.category.name] || {
        count: 0,
        amount: 0,
      };
      acc[l.category.name].count++;
      acc[l.category.name].amount += Number(l.approvedAmount);
      return acc;
    }, {} as Record<string, { count: number; amount: number }>),
  };

  const savingsSummary = {
    totalSavings: savings.length,
    totalAmount: savings.reduce((sum, s) => sum + Number(s.amount), 0),
    byCategory: savings.reduce((acc, s) => {
      acc[s.category.name] = acc[s.category.name] || {
        count: 0,
        amount: 0,
      };
      acc[s.category.name].count++;
      acc[s.category.name].amount += Number(s.amount);
      return acc;
    }, {} as Record<string, { count: number; amount: number }>),
  };
  const totalSavings = await getMemberTotalSavings(member.id);

  const report = {
    member: {
      id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      serviceNumber: member.service_number,
      email: member.email,
      phone: member.phone,
      totalSavings: totalSavings,
      monthlyDeduction: member.monthlyDeduction,
    },
    period: startDate && endDate ? { start: startDate, end: endDate } : null,
    transactions: transactionSummary,
    loans: loanSummary,
    savings: savingsSummary,
    recentTransactions: transactions.slice(0, 10).map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      date: t.createdAt,
      reference: t.reference,
      status: t.status,
      description: t.description,
      loanCategory: t.loan?.category.name || null,
      savingsCategory: t.saving?.category.name || null,
    })),
  };

  reportCache.set(cacheKey, report);
  return report;
};

export const getAllMembersFinancialSummary = async (
  startDate?: Date,
  endDate?: Date
) => {
  const cacheKey = getCacheKey("allMembersFinancialSummary", {
    startDate,
    endDate,
  });
  const cachedReport = reportCache.get(cacheKey);
  if (cachedReport) return cachedReport;

  const members = await prisma.member.findMany({
    select: {
      id: true,
      first_name: true,
      last_name: true,
      service_number: true,
      email: true,
      phone: true,
      monthlyDeduction: true,
    },
  });

  const whereClause: any = {};
  if (startDate && endDate) {
    whereClause.createdAt = {
      gte: startDate,
      lte: endDate,
    };
  }

  const [transactions, loans, savings] = await Promise.all([
    prisma.transaction.findMany({
      where: whereClause,
      select: {
        memberId: true,
        amount: true,
        type: true,
      },
    }),
    prisma.loan.findMany({
      select: {
        memberId: true,
        approvedAmount: true,
        status: true,
      },
    }),
    prisma.saving.findMany({
      select: {
        memberId: true,
        amount: true,
        status: true,
      },
    }),
  ]);

  const memberData = members.map((member) => {
    const memberTransactions = transactions.filter(
      (t) => t.memberId === member.id
    );
    const memberLoans = loans.filter((l) => l.memberId === member.id);
    const memberSavings = savings.filter((s) => s.memberId === member.id);
    const totalSavings = getMemberTotalSavings(member.id);

    return {
      id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      serviceNumber: member.service_number,
      email: member.email,
      phone: member.phone,
      totalSavings: totalSavings,
      monthlyDeduction: member.monthlyDeduction,
      transactionCount: memberTransactions.length,
      totalTransactionAmount: memberTransactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      ),
      loanCount: memberLoans.length,
      activeLoanCount: memberLoans.filter((l) => l.status === "ACTIVE").length,
      totalLoanAmount: memberLoans.reduce(
        (sum, l) => sum + Number(l.approvedAmount),
        0
      ),
      savingsCount: memberSavings.length,
      totalSavingsAmount: memberSavings.reduce(
        (sum, s) => sum + Number(s.amount),
        0
      ),
    };
  });

  const report = {
    period: startDate && endDate ? { start: startDate, end: endDate } : null,
    totalMembers: members.length,
    members: memberData,
    summary: {
      totalTransactions: transactions.length,
      totalTransactionAmount: transactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      ),
      totalLoans: loans.length,
      totalLoanAmount: loans.reduce(
        (sum, l) => sum + Number(l.approvedAmount),
        0
      ),
      totalSavings: savings.length,
      totalSavingsAmount: savings.reduce((sum, s) => sum + Number(s.amount), 0),
    },
  };

  reportCache.set(cacheKey, report);
  return report;
};

export const generateTrialBalanceReport = async (asOfDate: Date) => {
  const loans = await prisma.loan.findMany({
    where: {
      status: "ACTIVE",
    },
    select: {
      amount: true,
      approvedAmount: true,
    },
  });

  const savings = await prisma.saving.findMany({
    where: {
      status: "COMPLETED",
    },
    select: {
      amount: true,
    },
  });

  const repayments = await prisma.repayment.findMany({
    where: {
      status: "PAID",
      paidAt: {
        lte: asOfDate,
      },
    },
    select: {
      amount: true,
    },
  });

  const totalLoans = loans.reduce(
    (sum, loan) => sum + Number(loan.approvedAmount || loan.amount),
    0
  );
  const totalSavings = savings.reduce(
    (sum, saving) => sum + Number(saving.amount),
    0
  );
  const totalRepayments = repayments.reduce(
    (sum, repayment) => sum + Number(repayment.amount),
    0
  );

  return {
    asOfDate,
    accounts: [
      { name: "Loans Receivable", debit: totalLoans, credit: 0 },
      { name: "Savings Liability", debit: 0, credit: totalSavings },
      {
        name: "Interest Income",
        debit: 0,
        credit: totalRepayments - totalLoans,
      },
    ],
    totals: {
      debit: totalLoans,
      credit: totalSavings + (totalRepayments - totalLoans),
    },
  };
};

export const generateProfitLossReport = async (
  startDate: Date,
  endDate: Date
) => {
  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const loanInterest = transactions
    .filter((t) => t.type === "LOAN_REPAYMENT" && t.loanId)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const fees = transactions
    .filter((t) => t.type === "FEE")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const salaries = 0; // Would come from payroll system
  const operational = 0; // Would come from expense tracking

  return {
    period: { start: startDate, end: endDate },
    revenue: {
      loanInterest,
      fees,
      otherIncome: 0, // Additional income sources
      total: loanInterest + fees,
    },
    expenses: {
      salaries,
      operational,
      loanLossProvision: 0, // Reserve for bad loans
      total: salaries + operational,
    },
    netProfit: loanInterest + fees - (salaries + operational),
  };
};

export const generateBalanceSheetReport = async (asOfDate: Date) => {
  const cash = 0; // Would come from bank account balances
  const receivables = await getTotalLoanReceivables(asOfDate);
  const fixedAssets = 0; // Would come from asset tracking

  const savingsLiabilities = await getTotalSavingsLiabilities(asOfDate);
  const otherLiabilities = 0; // Other debts

  return {
    asOfDate,
    assets: {
      current: {
        cash,
        receivables,
        loansOutstanding: receivables,
        total: cash + receivables,
      },
      fixed: fixedAssets,
      total: cash + receivables + fixedAssets,
    },
    liabilities: {
      current: savingsLiabilities,
      longTerm: otherLiabilities,
      total: savingsLiabilities + otherLiabilities,
    },
    equity:
      cash +
      receivables +
      fixedAssets -
      (savingsLiabilities + otherLiabilities),
  };
};

const getTotalLoanReceivables = async (asOfDate: Date) => {
  const activeLoans = await prisma.loan.findMany({
    where: {
      status: "ACTIVE",
      startDate: {
        lte: asOfDate,
      },
    },
    include: {
      repayments: {
        where: {
          status: "PAID",
          paidAt: {
            lte: asOfDate,
          },
        },
      },
    },
  });

  return activeLoans.reduce((sum, loan) => {
    const paid = loan.repayments.reduce((sum, r) => sum + Number(r.amount), 0);
    return sum + (Number(loan.approvedAmount) - paid);
  }, 0);
};

const getTotalSavingsLiabilities = async (asOfDate: Date) => {
  const savings = await prisma.saving.findMany({
    where: {
      status: "COMPLETED",
      createdAt: {
        lte: asOfDate,
      },
    },
  });

  return savings.reduce((sum, saving) => sum + Number(saving.amount), 0);
};
