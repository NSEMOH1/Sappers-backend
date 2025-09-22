import { prisma } from "../config/database";

export const generateOTP = (): string => {
  return Math.floor(10000 + Math.random() * 900000).toString();
};

export const verifyOTP = async (
  loanId: string,
  userOtp: string
): Promise<boolean> => {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { otp: true, otpExpiresAt: true },
  });

  if (!loan || !loan.otp || !loan.otpExpiresAt) {
    return false;
  }

  const now = new Date();
  return loan.otp === userOtp && now < loan.otpExpiresAt;
};

export const generateSavingsReference = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SAV-${timestamp}-${random}`;
};

export const generateLoanReference = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LN-${timestamp}-${random}`;
};

export const calculateProcessingTime = (
  startTime: Date,
  endTime: Date
): string => {
  const diffMs = endTime.getTime() - startTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);

  if (diffMins > 0) {
    return `${diffMins}:${diffSecs.toString().padStart(2, "0")} mins`;
  } else {
    return `${diffSecs} secs`;
  }
};
