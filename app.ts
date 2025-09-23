import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";
import { errorHandler } from "./middleware/errorHandler";
import { config } from "./config/env";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/user";
import { loanRoutes } from "./routes/loan";
import { requestRoutes } from "./routes/request";
import { terminationRoutes } from "./routes/termination";
import { savingsRoutes } from "./routes/savings";
import { adminReportRoutes } from "./routes/report";

const createApp = () => {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  app.use(helmet());
  app.use(
    cors({
      origin: config.allowedOrigins,
      credentials: true,
    })
  );
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  });
  app.use(limiter);

  if (config.nodeEnv !== "test") {
    app.use(morgan("combined"));
  }
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  });

  app.use("/api", authRoutes);
  app.use("/api", userRoutes);
  app.use("/api/loan", loanRoutes);
  app.use("/api/requests", requestRoutes);
  app.use("/api/termination", terminationRoutes);
  app.use("/api/savings", savingsRoutes);
  app.use("/api/admin-report", adminReportRoutes);

  //   setupSocket(io);
  app.use(/.*/, (req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  app.use(errorHandler);

  return { app, httpServer };
};

export { createApp };
