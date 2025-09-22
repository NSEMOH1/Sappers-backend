import { Router, Request, Response, NextFunction } from "express";
import {
  AuthenticatedRequest,
  CreateMemberData,
  CreateUserData,
  LoginData,
  UserLoginData,
} from "../types";
import { createMember, createUser } from "../services/userService";
import {
  authenticateMember,
  authenticateUser,
  changePassword,
} from "../services/authService";
import { requireRoles } from "../middleware/requireRoles";
import { Role } from "../generated/prisma";
import path from "path";
import { handleFileUpload } from "../middleware/fileUpload";

const router = Router();

router.post(
  "/auth/member/register",
  handleFileUpload,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData: CreateMemberData = JSON.parse(req.body.data);
      const files = req.files as {
        profile_picture: Express.Multer.File[];
        identification: Express.Multer.File[];
        id_card: Express.Multer.File[];
        signature: Express.Multer.File[];
      };

      const transformedData = {
        ...userData,
        profile_picture: files.profile_picture?.[0]?.filename,
        identification: files.identification?.[0]?.filename,
        id_card: files.id_card?.[0]?.filename,
        signature: files.signature?.[0]?.filename,
      };

      const member = await createMember(transformedData);
      res.status(201).json({
        success: true,
        message: "Member created successfully.",
        data: {
          id: member.id,
          email: member.email,
          name: `${member.first_name} ${member.last_name}`,
          role: member.role,
          hasPassword: false,
        },
      });
    } catch (error) {
      if (req.files) {
        const files = req.files as Record<string, Express.Multer.File[]>;
        Object.values(files).forEach((fileArray) => {
          fileArray.forEach((file) => {
            require("fs").unlink(
              path.join(__dirname, "../uploads", file.filename),
              () => {}
            );
          });
        });
      }
      next(error);
    }
  }
);

router.post(
  "/auth/user/register",
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userData: CreateUserData = req.body;

      if (!userData) {
        res.status(401).json({
          success: false,
          message: "Please make sure all parameters are sent",
        });
        return;
      }
      await createUser(userData);

      res.json({
        success: true,
        message: "User Created Successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/auth/change-password",
  requireRoles([Role.ADMIN, Role.MEMBER]),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { oldPassword, newPassword } = req.body;
      const memberId = req.user?.id;

      if (!memberId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });

        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters long",
        });
        return;
      }

      await changePassword({
        memberId,
        oldPassword,
        newPassword,
      });

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/auth/member/login",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loginData: LoginData = req.body;

      const result = await authenticateMember(loginData);

      res.json({
        success: true,
        message: "Login successful",
        ...result,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Account not activated")) {
          res.status(403).json({
            success: false,
            message: "Account not activated. Please contact administrator.",
            code: "ACCOUNT_NOT_ACTIVATED",
          });
          return;
        } else if (error.message === "Invalid credentials") {
          res.status(401).json({
            success: false,
            message: "Invalid email or password",
          });
          return;
        }
      }
      next(error);
    }
  }
);

router.post(
  "/auth/user/login",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loginData: UserLoginData = req.body;

      const result = await authenticateUser(loginData);

      res.json({
        success: true,
        message: "Login successful",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as authRoutes };
