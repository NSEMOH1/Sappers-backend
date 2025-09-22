import { LoanName, LoanStatus, TransactionType } from "@prisma/client";
import {
  Department,
  Gender,
  MemberStatus,
  Rank,
  Relationship,
  Role,
  Title,
  UserStatus,
} from "../generated/prisma";
import { Request } from "express";
import Decimal from "decimal.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    role: Role;
    full_name?: string;
  };
}

export interface CreateMemberData {
  email: string;
  first_name: string;
  last_name: string;
  other_name: string;
  gender: string;
  phone: string;
  title: Title;
  address: string;
  state_of_origin: string;
  lga: string;
  pin: string;
  date_of_birth: Date;
  service_number: string;
  profile_picture: string;
  monthlyDeduction: number;
  bankName: string;
  account_number: string;
  identification: string;
  id_card: string;
  signature: string;
  securityQuestion: string;
  securityAnswer: string;
  rank: string;
  unit: string;
  kinFirstName: string;
  kinLastName: string;
  relationship: Relationship;
  kinEmail: string;
  kinTitle: Title;
}

export interface UpdateMemberData {
  email?: string;
  first_name?: string;
  last_name?: string;
  other_name?: string;
  gender?: string;
  phone?: string;
  title?: Title;
  address?: string;
  state_of_origin?: string;
  lga?: string;
  pin?: string;
  date_of_birth?: Date;
  service_number?: string;
  profile_picture?: string;
  monthlyDeduction?: number;
  bankName: string;
  account_number: string;
  identification?: string;
  id_card?: string;
  signature?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  rank?: string;
  unit?: string;
  kinFirstName?: string;
  kinLastName?: string;
  relationship?: Relationship;
  kinEmail?: string;
  kinTitle?: Title;
}

export interface LoginData {
  service_number: string;
  password: string;
}

export interface UserLoginData {
  email: string;
  password: string;
}

export interface CreateUserData {
  email: string;
  full_name: string;
  password: string;
  role: Role;
  department: Department;
}

export interface UpdateUserData {
  email?: string;
  full_name?: string;
  password?: string;
  role?: Role;
  rank?: Rank;
  department?: Department;
}

export interface UserResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  other_name: string;
  gender: Gender;
  phone: string;
  address: string;
  state_of_origin: string;
  service_number: string;
  role: Role;
  rank: Rank;
  created_at: Date;
  updated_at: Date;
}

export interface AuthResponse {
  token: string;
  user: UserResponse;
}

export interface JwtPayload {
  id: string;
  email: string;
  [key: string]: any;
}

export interface GetAllMembersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "created_at" | "email" | "first_name" | "last_name";
  sortOrder?: "asc" | "desc";
  role?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  status?: MemberStatus;
}

export interface GetAllUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "created_at" | "email";
  sortOrder?: "asc" | "desc";
  role?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  status?: UserStatus;
}

export interface PaginatedMembersResponse {
  users: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    created_at: Date;
  }[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalMembers: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface PaginatedUsersResponse {
  users: {
    id: string;
    email: string;
    full_name: string;
    status: UserStatus;
    created_at: Date;
  }[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface LoanBalance {
  loanId: string;
  category: LoanName;
  reference: string;
  originalAmount: number;
  approvedAmount: number;
  interestRate: number;
  durationMonths: number;
  totalPaid: number;
  outstandingBalance: number;
  status: LoanStatus;
  startDate?: string;
  endDate?: string;
  nextPayment?: {
    dueDate: string;
    amount: number;
  };
  repaymentProgress: {
    paid: number;
    remaining: number;
    percentage: number;
  };
}

export interface MemberLoanHistory {
  id: string;
  reference: string;
  category: string;
  appliedAmount: number;
  approvedAmount: number;
  interestRate: number;
  durationMonths: number;
  status: LoanStatus;
  applicationDate: Date;
  approvalDate: Date | null;
  completionDate: Date | null;
  totalRepaid: number;
  outstandingBalance: number;
  nextPaymentDue?: {
    date: Date;
    amount: number;
  };
  repayments: {
    dueDate: Date;
    amount: number;
    status: string;
    paidDate: Date | null;
  }[];
  transactions: {
    id: string;
    type: TransactionType;
    amount: number;
    date: Date;
    status: string;
    description: string;
  }[];
}

export interface CooperativeSavingsRecord {
  serviceNumber: string;
  amount: number;
  memberName?: string;
}

export interface createSavings {
  memberId: string;
  category_name: string;
  amount: Decimal;
}

export interface IWithdrawSavings {
  memberId: string;
  category_name: string;
  amount: Decimal;
  pin: string;
}

export interface UploadResult {
  success: boolean;
  processedCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    serviceNumber?: string;
    error: string;
  }>;
  summary: {
    totalAmount: number;
    validRecords: number;
    invalidRecords: number;
  };
}
export interface RequestData {
  reason: string;
  amount: string;
  memberId: string;
}

export interface ITermination {
  memberId: string;
  reason: string;
}