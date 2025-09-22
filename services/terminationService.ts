import { prisma } from "../config/database";
import { ITermination } from "../types";

export const requestTermination = async (data: ITermination) => {
  if (!data.reason) throw new Error("Reason for termination is required");
  const result = await prisma.termination.create({
    data: {
      memberId: data.memberId,
      reason: data.reason,
    },
  });

  return result;
};

export const getAllTerminations = async (
  page = 1,
  limit = 10,
  startDate?: string,
  endDate?: string
) => {
  const skip = (page - 1) * limit;

  const whereClause: any = {};
  if (startDate && endDate) {
    whereClause.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }
  const total = await prisma.termination.count({
    where: whereClause,
  });

  const result = await prisma.termination.findMany({
    where: whereClause,
    include: {
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
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: limit,
  });

  if (!result || result.length === 0) {
    return {
      success: true,
      message: "No Termination Request found",
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }

  return {
    data: result,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};
