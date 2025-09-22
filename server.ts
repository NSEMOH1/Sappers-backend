import { createApp } from "./app";
import { config } from "./config/env";
import { prisma } from "./config/database";

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    const { httpServer } = createApp();

    httpServer.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`📖 Environment: ${config.nodeEnv}`);
    });

    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down server...");
      await prisma.$disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
