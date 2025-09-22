import { findMemberByServiceNumber, findUserByEmail } from "./userService";
import {
  comparePasswords,
  generateRandomPassword,
  hashPassword,
} from "../utils/password";
import { generateToken } from "../utils/jwt";
import { prisma } from "../config/database";
import { LoginData, UserLoginData } from "../types";
import { MemberStatus } from "../generated/prisma";
import { UserStatus } from "@prisma/client";


export const authenticateMember = async (loginData: LoginData) => {
  const member = await findMemberByServiceNumber(loginData.service_number);
  if (!member) {
    throw new Error("Invalid credentials");
  }
  if (!member.password) {
    throw new Error(
      "Account not activated. Please contact administrator for password setup."
    );
  }
  if (member.status === "INACTIVE") {
    throw new Error(
      "Your account has is not active. Please contact the administrator."
    );
  }
  const isPasswordValid = await comparePasswords(
    loginData.password,
    member.password
  );
  if (!isPasswordValid) {
    throw new Error("Invalid credentials");
  }
  const token = generateToken({
    id: member.id,
    role: member.role,
  });

  return {
    token,
    user: {
      id: member.id,
      email: member.email,
      first_name: member.first_name,
      last_name: member.last_name,
      role: member.role,
    },
  };
};

export const authenticateUser = async (loginData: UserLoginData) => {
  const user = await findUserByEmail(loginData.email);

  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (!user.password) {
    throw new Error("Password is required");
  }

  if (user.status === UserStatus.INACTIVE) {
    throw new Error(
      "You have been suspended, your account is currently inactive"
    );
  }

  const isPasswordValid = await comparePasswords(
    loginData.password,
    user.password
  );

  if (!isPasswordValid) {
    throw new Error("Invalid credentials");
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
  };
};

export const generateMemberPassword = async (data: { memberId: string }) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: data.memberId },
    });

    if (!member) {
      throw new Error("Member not found");
    }

    if (member.status !== MemberStatus.APPROVED) {
      throw new Error("Member has not been approved");
    }

    const temporaryPassword = generateRandomPassword();
    const hashedPassword = await hashPassword(temporaryPassword);

    const updateData: any = {
      password: hashedPassword,
      updated_at: new Date(),
    };

    const updatedMember = await prisma.member.update({
      where: { id: data.memberId },
      data: updateData,
    });

    return {
      success: true,
      temporaryPassword: temporaryPassword,
      message: "Password generated successfully",
      user: {
        id: updatedMember.id,
        email: updatedMember.email,
        service_number: updatedMember.service_number,
      },
    };
  } catch (error) {
    console.error("Error generating password:", error);
    throw error;
  }
};

export const changePassword = async (data: {
  memberId: string;
  oldPassword: string;
  newPassword: string;
}) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: data.memberId },
    });

    if (!member || !member.password) {
      throw new Error("User not found");
    }
    const isOldPasswordValid = await comparePasswords(
      data.oldPassword,
      member.password
    );

    if (!isOldPasswordValid) {
      throw new Error("Current password is incorrect");
    }
    const hashedNewPassword = await hashPassword(data.newPassword);

    await prisma.member.update({
      where: { id: data.memberId },
      data: {
        password: hashedNewPassword,
      },
    });

    return {
      success: true,
      message: "Password changed successfully",
    };
  } catch (error) {
    console.error("Error changing password:", error);
    throw error;
  }
};
// export const sendPasswordResetOtp = async (email: string) => {
//     const [member, user] = await Promise.all([
//         prisma.member.findUnique({ where: { email } }),
//         prisma.user.findUnique({ where: { email } }),
//     ]);

//     if (!member && !user) {
//         throw new Error("Email not found");
//     }

//     const otp = generateOTP();
//     const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
//     const isMember = !!member;
//     const userId = member ? member.id : user?.id;

//     if (!userId) {
//         throw new Error("User ID not found");
//     }

//     await prisma.passwordReset.create({
//         data: isMember
//             ? {
//                   email,
//                   token: otp,
//                   expiresAt,
//                   userType: Role.MEMBER,
//                   member: { connect: { id: member.id } },
//               }
//             : {
//                   email,
//                   token: otp,
//                   expiresAt,
//                   userType: user?.role || Role.STAFF,
//                   member: undefined,
//               },
//     });

//     console.log(`OTP for ${email}: ${otp}`);

//     return { success: true, otp };
// };

// export const verifyResetOtp = async (email: string, otp: string) => {
//     const record = await prisma.passwordReset.findFirst({
//         where: {
//             email,
//             token: otp,
//             expiresAt: { gt: new Date() },
//             used: false,
//         },
//     });

//     if (!record) {
//         throw new Error("Invalid or expired OTP");
//     }

//     return {
//         success: true,
//         isMember: record.userType === Role.MEMBER,
//     };
// };

// export const updatePassword = async (
//     email: string,
//     newPassword: string,
//     isMember: boolean
// ) => {
//     const hashedPassword = await hashPassword(newPassword);

//     await prisma.$transaction([
//         isMember ?
//             prisma.member.update({
//                 where: { email },
//                 data: { password: hashedPassword },
//             }) :
//             prisma.user.update({
//                 where: { email },
//                 data: { password: hashedPassword },
//             }),
//         prisma.passwordReset.updateMany({
//             where: { email },
//             data: { used: true, token: "" },
//         }),
//     ]);

//     return { success: true };
// };
// // // Email service (implement based on your email provider)
// // const sendPasswordEmail = async (email: string, password: string, name: string) => {
// //     // Implement your email sending logic here
// //     // This could use SendGrid, AWS SES, Nodemailer, etc.
// //     console.log(`Email sent to ${email} with temporary password: ${password}`);

// //     // Example implementation:
// //     // await emailService.send({
// //     //     to: email,
// //     //     subject: "Your Account Password",
// //     //     template: "password-notification",
// //     //     data: {
// //     //         name: name,
// //     //         temporaryPassword: password,
// //     //         loginUrl: process.env.FRONTEND_URL + "/login"
// //     //     }
// //     // });
// // };
