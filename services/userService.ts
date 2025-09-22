import { Role, MemberStatus } from "../generated/prisma";
import { prisma } from "../config/database";
import {
  CreateMemberData,
  CreateUserData,
  GetAllMembersParams,
  GetAllUsersParams,
  PaginatedMembersResponse,
  PaginatedUsersResponse,
  UpdateUserData,
} from "../types";
import { hashPassword, hashPin } from "../utils/password";
import { UserStatus } from "@prisma/client";

export const createMember = async (userData: CreateMemberData) => {
  const hashedPin = await hashPin(userData.pin.toString());
  return await prisma.$transaction(async () => {
    try {
      const memberData: any = {
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        other_name: userData.other_name,
        gender: userData.gender,
        phone: userData.phone,
        title: userData.title,
        address: userData.address,
        state_of_origin: userData.state_of_origin,
        lga: userData.lga,
        role: Role.MEMBER,
        pin: hashedPin,
        service_number: userData.service_number,
        profile_picture: userData.profile_picture,
        date_of_birth: userData.date_of_birth,
        monthlyDeduction: userData.monthlyDeduction || 0,
        bank: {
          create: {
            name: userData.bankName,
            account_number: userData.account_number,
          },
        },
        kycInfo: {
          create: {
            identification: userData.identification,
            id_card: userData.id_card,
            signature: userData.signature || "",
          },
        },
        security: {
          create: {
            question: userData.securityQuestion,
            answer: userData.securityAnswer,
          },
        },
        nextOfKin: {
          create: {
            title: userData.kinTitle,
            first_name: userData.kinFirstName,
            last_name: userData.kinLastName,
            kin_email: userData.kinEmail,
            relationship: userData.relationship,
          },
        },
      };

      const user = await prisma.member.create({
        data: memberData,
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          created_at: true,
        },
      });

      return user;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Unique constraint")) {
          throw new Error(error.message.replace(/\n/g, " "));
        }
      }
      throw error;
    }
  });
};

export const createUser = async (userData: CreateUserData) => {
  const hashedPassword = await hashPassword(userData.password);
  try {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        full_name: userData.full_name,
        password: hashedPassword,
        role: Role.ADMIN,
        department: userData.department,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        created_at: true,
      },
    });

    return user;
  } catch (error) {
    throw error;
  }
};

export const updateUser = async (userId: string, userData: UpdateUserData) => {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        email: userData.email,
        full_name: userData.full_name,
        ...(userData.password && { password: userData.password }),
        role: userData.role,
        department: userData.department,
        updated_at: new Date(),
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        department: true,
        created_at: true,
        updated_at: true,
      },
    });

    return user;
  } catch (error) {
    throw error;
  }
};

export const deleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new Error("Member not found");
  }

  return prisma.user.delete({
    where: { id },
    select: {
      id: true,
    },
  });
};

export const updateMember = async (id: string, userData: any) => {
  const existingUser = await prisma.member.findUnique({ where: { id } });
  if (!existingUser) {
    throw new Error("User not found");
  }

  const user = await prisma.member.update({
    where: { id },
    data: { ...userData },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      created_at: true,
    },
  });

  return user;
};

export const deleteMember = async (id: string) => {
  const member = await prisma.member.findUnique({
    where: { id },
  });

  if (!member) {
    throw new Error("Member not found");
  }

  return prisma.user.delete({
    where: { id },
    select: {
      id: true,
    },
  });
};

export const findMemberByServiceNumber = async (service_number: string) => {
  if (!service_number) {
    throw new Error("Service number is required");
  }

  const member = await prisma.member.findUnique({
    where: {
      service_number: service_number,
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      password: true,
      role: true,
      status: true,
      service_number: true,
      bank: {
        select: {
          name: true,
          account_number: true,
        },
      },
    },
  });

  return member;
};

export const findUserByEmail = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email: email },
    select: {
      id: true,
      full_name: true,
      email: true,
      password: true,
      role: true,
      status: true,
    },
  });

  if (!user) throw new Error("User does not exist");

  return user;
};

export const findMemberById = async (id: string) => {
  const member = await prisma.member.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      created_at: true,
      service_number: true,
      bank: true,
      address: true,
      phone: true,
      savings: true,
    },
  });

  if (!member) throw new Error("Member does not exist");

  return member;
};

export const getAllMembers = async (
  params: GetAllMembersParams = {}
): Promise<PaginatedMembersResponse> => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sortBy = "created_at",
    sortOrder = "desc",
    role,
    status,
    createdAfter,
    createdBefore,
  } = params;

  const offset = (page - 1) * limit;
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      {
        email: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        first_name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        last_name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        service_number: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (role) {
    whereClause.role = role;
  }
  if (status) {
    whereClause.status = status;
  }

  if (createdAfter || createdBefore) {
    whereClause.created_at = {};
    if (createdAfter) {
      whereClause.created_at.gte = createdAfter;
    }
    if (createdBefore) {
      whereClause.created_at.lte = createdBefore;
    }
  }

  const totalMembers = await prisma.member.count({
    where: whereClause,
  });

  const users = await prisma.member.findMany({
    where: whereClause,
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip: offset,
    take: limit,
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      other_name: true,
      phone: true,
      service_number: true,
      status: true,
      role: true,
      created_at: true,
      updated_at: true,
      bank: {
        select: {
          account_number: true,
          name: true,
        },
      },
      password: false,
      pin: false,
    },
  });

  const totalPages = Math.ceil(totalMembers / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    users,
    pagination: {
      currentPage: page,
      totalPages,
      totalMembers,
      hasNextPage,
      hasPreviousPage,
    },
  };
};

export const approveMember = async (data: { memberId: string }) => {
  const member = await prisma.member.findUnique({
    where: { id: data.memberId },
  });

  if (!member) {
    throw new Error("Member not found");
  }

  if (member.status === MemberStatus.APPROVED) {
    throw new Error("Member approved already");
  }

  const updateData: any = {
    status: MemberStatus.APPROVED,
    updated_at: new Date(),
  };

  const updatedMember = await prisma.member.update({
    where: { id: data.memberId },
    data: updateData,
  });

  return updatedMember;
};

export const rejectMember = async (data: { memberId: string }) => {
  const member = await prisma.member.findUnique({
    where: { id: data.memberId },
  });

  if (!member) {
    throw new Error("Member not found");
  }
  if (member.status === MemberStatus.REJECTED) {
    throw new Error("Member rejected already");
  }

  const updateData: any = {
    status: MemberStatus.REJECTED,
    updated_at: new Date(),
  };

  const updatedMember = await prisma.member.update({
    where: { id: data.memberId },
    data: updateData,
  });

  return updatedMember;
};

export const changePin = async (pin: string, memberId: string) => {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      pin: true,
    },
  });

  if (!member) {
    throw new Error("Member not found");
  }

  const updatedMember = await prisma.member.update({
    where: { id: memberId },
    data: {
      pin: pin,
    },
    select: {
      id: true,
    },
  });

  return {
    data: updatedMember,
    message: "Transaction Pin Changed Successfully",
  };
};

export const getAllUsers = async (
  params: GetAllUsersParams = {}
): Promise<PaginatedUsersResponse> => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sortBy = "created_at",
    sortOrder = "desc",
    role,
    status,
    createdAfter,
    createdBefore,
  } = params;

  const offset = (page - 1) * limit;
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      {
        email: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        first_name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        last_name: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (role) {
    whereClause.role = role;
  }
  if (status) {
    whereClause.status = status;
  }

  if (createdAfter || createdBefore) {
    whereClause.created_at = {};
    if (createdAfter) {
      whereClause.created_at.gte = createdAfter;
    }
    if (createdBefore) {
      whereClause.created_at.lte = createdBefore;
    }
  }

  const totalUsers = await prisma.user.count({
    where: whereClause,
  });

  const users = await prisma.user.findMany({
    where: whereClause,
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip: offset,
    take: limit,
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      created_at: true,
      updated_at: true,
      status: true,
    },
  });

  const totalPages = Math.ceil(totalUsers / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    users,
    pagination: {
      currentPage: page,
      totalPages,
      totalUsers,
      hasNextPage,
      hasPreviousPage,
    },
  };
};
