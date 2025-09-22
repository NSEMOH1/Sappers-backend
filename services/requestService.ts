import { RequestStatus } from "@prisma/client";
import { prisma } from "../config/database";
import { RequestData } from "../types";

export const sendRequest = async (data: RequestData) => {
  const request = await prisma.request.create({
    data: {
      reason: data.reason,
      amount: parseFloat(data.amount),
      memberId: data.memberId,
    },
  });
  return request;
};

export const approveRequest = async (data: { requestId: string }) => {
  const result = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.request.update({
      where: { id: data.requestId },
      data: {
        status: RequestStatus.APPROVED,
        updatedAt: new Date(),
      },
    });

    return { updatedRequest };
  });

  return {
    success: true,
    request: result.updatedRequest,
    message: "Request approved successfully",
  };
};

export const rejectRequest = async (data: { requestId: string }) => {
  const result = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.request.update({
      where: { id: data.requestId },
      data: {
        status: RequestStatus.REJECTED,
        updatedAt: new Date(),
      },
    });

    return { updatedRequest };
  });

  return {
    success: true,
    request: result.updatedRequest,
    message: "Request rejected successfully",
  };
};

export const getAllRequests = async (startDate?: Date, endDate?: Date) => {
  const requests = await prisma.request.findMany({
    where: {
      ...(startDate && endDate
        ? {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }
        : {}),
    },
    select: {
      id: true,
      reason: true,
      amount: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      member: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          service_number: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    success: true,
    count: requests.length,
    requests,
    ...(startDate && endDate
      ? { period: { start: startDate, end: endDate } }
      : {}),
  };
};
