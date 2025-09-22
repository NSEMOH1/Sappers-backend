import { NextFunction, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const fs = require("fs").promises;

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, "..", "uploads");
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error: any) {
      cb(error, "");
      if (req.files) {
        const files = req.files as Record<string, Express.Multer.File[]>;
        for (const fileArray of Object.values(files)) {
          for (const file of fileArray) {
            try {
              await fs.unlink(
                path.join(__dirname, "..", "uploads", file.filename)
              );
            } catch (unlinkError) {
              console.error(
                `Failed to delete file ${file.filename}:`,
                unlinkError
              );
            }
          }
        }
      }
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only JPEG, PNG, and PDF are allowed"),
      false
    );
  }
};

export const handleFileUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1 * 1024 * 1024 },
}).fields([
  { name: "profile_picture", maxCount: 1 },
  { name: "identification", maxCount: 1 },
  { name: "id_card", maxCount: 1 },
  { name: "signature", maxCount: 1 },
]);

export const multerErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        success: false,
        message: "File size exceeds 5MB limit.",
      });
      return;
    }
    res.status(400).json({
      success: false,
      message: `Multer error: ${err.message}`,
    });
    return;
  }
  next(err);
};
