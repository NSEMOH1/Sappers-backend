import {
  Rank,
  SavingStatus,
  SavingType,
  TransactionType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../config/database";
import {
  CooperativeSavingsRecord,
  createSavings,
  IWithdrawSavings,
  UploadResult,
} from "../types";
import { generateSavingsReference } from "../utils/functions";
import { comparePin } from "../utils/password";
import * as XLSX from "xlsx";
import { endOfMonth, startOfMonth } from "date-fns";

export const getMemberTotalSavings = async (memberId: string) => {
  const result = await prisma.saving.aggregate({
    where: { memberId },
    _sum: { amount: true },
  });

  return result._sum.amount || new Decimal(0);
};
export const addSavings = async (data: createSavings) => {
  const validCategories = ["QUICK", "COOPERATIVE"] as const;

  if (!validCategories.includes(data.category_name as SavingType)) {
    throw new Error(
      `Invalid category. Must be one of: ${validCategories.join(", ")}`
    );
  }

  const category = await prisma.savingCategory.findUnique({
    where: { type: data.category_name as SavingType },
  });

  if (!category) {
    throw new Error("Savings Category doesn't exist");
  }

  const member = await prisma.member.findUnique({
    where: { id: data.memberId },
  });

  if (!member) {
    throw new Error("Member doesn't exist");
  }

  const amount =
    typeof data.amount === "object" && "toNumber" in data.amount
      ? data.amount.toNumber()
      : Number(data.amount);
  if (amount < 5000) {
    throw new Error("You cannot deposit less than ₦5000");
  }
  const result = await prisma.$transaction(async (tx) => {
    const saving = await tx.saving.create({
      data: {
        memberId: data.memberId,
        categoryId: category.id,
        amount: amount,
        reference: generateSavingsReference(),
        status: "COMPLETED",
      },
      include: {
        member: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await tx.transaction.create({
      data: {
        memberId: data.memberId,
        amount: data.amount,
        type: TransactionType.SAVINGS_DEPOSIT,
        reference: saving.reference,
        description: `Savings deposit to ${category.name}`,
        status: "COMPLETED",
      },
    });

    return saving;
  });

  return result;
};

export const withdrawSavings = async (data: IWithdrawSavings) => {
  const validCategories = ["QUICK", "COOPERATIVE"] as const;
  if (!validCategories.includes(data.category_name as SavingType)) {
    throw new Error(
      `Invalid category. Must be one of: ${validCategories.join(", ")}`
    );
  }

  const category = await prisma.savingCategory.findUnique({
    where: { type: data.category_name as SavingType },
  });

  if (!category) throw new Error("Savings Category doesn't exist");
  if (category.name === "COOPERATIVE")
    throw new Error(
      "You cannot withdraw this at the moment, Please contact the Admin for more information"
    );

  const member = await prisma.member.findUnique({
    where: { id: data.memberId },
    select: { id: true, pin: true },
  });

  if (!member) throw new Error("Member doesn't exist");

  const isPinValid = await comparePin(data.pin, member.pin);
  if (!isPinValid) throw new Error("Invalid PIN");

  const amount = new Decimal(data.amount);
  const zero = new Decimal(0);
  const totalSavings = await getMemberTotalSavings(member.id);

  if (amount.lte(zero)) throw new Error("Amount must be greater than zero");
  if (totalSavings.lt(amount)) throw new Error("Insufficient savings balance");

  const result = await prisma.$transaction(async (tx) => {
    const saving = await tx.saving.create({
      data: {
        memberId: data.memberId,
        categoryId: category.id,
        amount: amount.negated(),
        reference: generateSavingsReference(),
        status: SavingStatus.COMPLETED,
      },
      include: {
        member: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        category: { select: { id: true, name: true } },
      },
    });

    await tx.transaction.create({
      data: {
        memberId: data.memberId,
        amount: amount.toNumber(),
        type: TransactionType.SAVINGS_WITHDRAWAL,
        reference: saving.reference,
        description: `Savings withdrawal from ${category.name}`,
        status: SavingStatus.COMPLETED,
      },
    });

    return saving;
  });

  return result;
};

export const getSavingsBalance = async (memberId: string) => {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      monthlyDeduction: true,
      id: true,
    },
  });

  if (!member) {
    throw new Error("Member doesn't exist");
  }

  const savingsByCategory = await prisma.saving.groupBy({
    by: ["categoryId"],
    where: {
      memberId: memberId,
    },
    _sum: {
      amount: true,
    },
  });

  const categories = await prisma.savingCategory.findMany({
    where: {
      id: {
        in: savingsByCategory.map((s) => s.categoryId),
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  const totalSavings = await getMemberTotalSavings(member.id);

  const result = {
    totalSavings: totalSavings,
    monthlyDeduction: member.monthlyDeduction,
    normalSavings: new Decimal(0),
    cooperativeSavings: new Decimal(0),
    details: [] as Array<{
      categoryId: string;
      categoryName: string;
      amount: Decimal;
    }>,
  };

  savingsByCategory.forEach((saving) => {
    const category = categories.find((c) => c.id === saving.categoryId);
    if (category) {
      const amount = saving._sum.amount
        ? new Decimal(saving._sum.amount)
        : new Decimal(0);

      result.details.push({
        categoryId: category.id,
        categoryName: category.name,
        amount,
      });

      if (category.type === "QUICK") {
        result.normalSavings = result.normalSavings.add(amount);
      } else if (category.type === "COOPERATIVE") {
        result.cooperativeSavings = result.cooperativeSavings.add(amount);
      }
    }
  });

  return result;
};

export const editDeduction = async (amount: number, memberId: string) => {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      monthlyDeduction: true,
    },
  });

  if (!member) {
    throw new Error("Member not found");
  }

  const updatedMember = await prisma.member.update({
    where: { id: memberId },
    data: {
      monthlyDeduction: amount,
    },
    select: {
      id: true,
      monthlyDeduction: true,
    },
  });

  return {
    data: updatedMember,
    message: "Monthly deduction updated successfully",
  };
};

export const getAllSavings = async () => {
  const [savings, total] = await Promise.all([
    prisma.saving.findMany({
      select: {
        id: true,
        member: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
          },
        },
        amount: true,
        category: true,
        reference: true,
        createdAt: true,
        status: true,
      },
    }),
    prisma.saving.aggregate({
      _sum: {
        amount: true,
      },
    }),
  ]);

  return {
    savings: savings,
    total: total._sum.amount || 0,
  };
};

export const uploadCooperativeSavingsFromExcel = async (
  fileBuffer: Buffer,
  uploadedBy?: string
): Promise<UploadResult> => {
  const result: UploadResult = {
    success: false,
    processedCount: 0,
    errorCount: 0,
    errors: [],
    summary: {
      totalAmount: 0,
      validRecords: 0,
      invalidRecords: 0,
    },
  };

  try {
    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, { type: "buffer" });
    } catch (error) {
      throw new Error("Invalid Excel file format");
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error("Excel file contains no worksheets");
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error("Could not access the first worksheet");
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (!jsonData || jsonData.length === 0) {
      throw new Error("Excel worksheet contains no data");
    }

    const firstRow = jsonData[0];
    if (!firstRow) {
      throw new Error("Could not read first row of data");
    }

    const hasServiceNumber =
      firstRow["Service Number"] ||
      firstRow["service_number"] ||
      firstRow["ServiceNumber"];
    const hasAmount =
      firstRow["Amount"] || firstRow["amount"] || firstRow["Deduction"];

    if (!hasServiceNumber || !hasAmount) {
      throw new Error(
        "Excel file is missing required columns (Service Number and Amount)"
      );
    }

    // Get cooperative savings category
    const cooperativeCategory = await prisma.savingCategory.findUnique({
      where: { type: SavingType.COOPERATIVE },
    });

    if (!cooperativeCategory) {
      throw new Error("Cooperative savings category not found");
    }

    // Process records in transaction
    await prisma.$transaction(async (tx) => {
      const validRecords: CooperativeSavingsRecord[] = [];

      // Validate and parse data
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // Excel row number (assuming row 1 is header)

        try {
          // Extract data (adjust column names based on your Excel structure)
          const serviceNumber =
            row["Service Number"] ||
            row["service_number"] ||
            row["ServiceNumber"];
          const amount = parseFloat(
            row["Amount"] || row["amount"] || row["Deduction"]
          );
          const memberName = row["Name"] || row["name"] || row["Member Name"];

          // Validate required fields
          if (!serviceNumber) {
            result.errors.push({
              row: rowNumber,
              error: "Service number is required",
            });
            continue;
          }

          if (!amount || amount <= 0) {
            result.errors.push({
              row: rowNumber,
              serviceNumber: serviceNumber.toString(),
              error: "Valid amount is required",
            });
            continue;
          }

          validRecords.push({
            serviceNumber: serviceNumber.toString().trim(),
            amount,
            memberName: memberName?.toString().trim(),
          });
        } catch (error) {
          result.errors.push({
            row: rowNumber,
            error: `Error parsing row: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          });
        }
      }

      result.summary.validRecords = validRecords.length;
      result.summary.invalidRecords = result.errors.length;

      // Process valid records
      for (const record of validRecords) {
        try {
          // Find member by service number
          const member = await tx.member.findFirst({
            where: { service_number: record.serviceNumber },
            select: {
              id: true,
              first_name: true,
              last_name: true,
              service_number: true,
            },
          });

          if (!member) {
            result.errors.push({
              row: 0, // We don't have row number at this point
              serviceNumber: record.serviceNumber,
              error: "Member with this service number not found",
            });
            result.errorCount++;
            continue;
          }

          // Validate member name if provided in Excel
          if (record.memberName) {
            const fullName =
              `${member.first_name} ${member.last_name}`.toLowerCase();
            const providedName = record.memberName.toLowerCase();

            if (
              !fullName.includes(providedName) &&
              !providedName.includes(fullName)
            ) {
              result.errors.push({
                row: 0,
                serviceNumber: record.serviceNumber,
                error: `Name mismatch: Expected '${fullName}', found '${record.memberName}'`,
              });
              result.errorCount++;
              continue;
            }
          }

          const amount = new Decimal(record.amount);
          const reference = generateSavingsReference();

          // Create cooperative savings record
          const saving = await tx.saving.create({
            data: {
              memberId: member.id,
              categoryId: cooperativeCategory.id,
              amount: amount,
              reference: reference,
              status: SavingStatus.COMPLETED,
            },
          });

          // Create transaction record
          await tx.transaction.create({
            data: {
              memberId: member.id,
              amount: amount.toNumber(),
              type: TransactionType.SAVINGS_DEPOSIT,
              reference: reference,
              description: `Cooperative savings deduction from external bank account (Service No: ${record.serviceNumber})`,
              status: "COMPLETED",
            },
          });

          result.processedCount++;
          result.summary.totalAmount += record.amount;
        } catch (error) {
          result.errors.push({
            row: 0,
            serviceNumber: record.serviceNumber,
            error: `Error processing record: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          });
          result.errorCount++;
        }
      }
    });

    result.success = result.processedCount > 0;

    return result;
  } catch (error) {
    throw new Error(
      `Failed to process Excel file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};