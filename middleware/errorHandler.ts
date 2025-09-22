import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Error occurred:", error.stack);

  if (error.message === "Invalid credentials") {
    res.status(401).json({ error: error.message });
    return;
  }

  if (error.message.includes("Unique constraint")) {
    res.status(409).json({ error: "Resource already exists" });
    return;
  }

  if (error.name === "PrismaClientKnownRequestError") {
    res.status(400).json({ error: "Database operation failed" });
    return;
  }

  if (error.name === "ValidationError") {
    res.status(400).json({ error: "Invalid input data" });
    return;
  }

  if (error.message.includes("Too many requests")) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  if (error.message === "Forbidden") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  res.status(500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV === "development" && {
      details: error.message,
    }),
  });
};
