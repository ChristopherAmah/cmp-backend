import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import { startRemindersCron } from "./services/remindersJob.js";
import { startInvoiceStatusCron } from "./services/invoiceStatusCron.js";

// Load env vars
dotenv.config();

const app = express();

// Trust proxy headers (needed to get real client IP behind proxies/load balancers)
// This makes req.ip and x-forwarded-for accurate in production
app.set("trust proxy", 1);

// Middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// Security headers
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? {
            useDefaults: true,
            directives: {
              "default-src": ["'self'"],
              "script-src": ["'self'", "'unsafe-inline'"],
              "style-src": ["'self'", "'unsafe-inline'"],
              "img-src": ["'self'", "data:", "https:", "blob:"],
              "connect-src": ["'self'", process.env.FRONTEND_URL || "'self'"],
            },
          }
        : false,
    referrerPolicy: { policy: "no-referrer" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Basic rate limiting (global)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // max 1000 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://cmp-frontend-six.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:5175",
  "http://localhost:5176",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Content-Range", "Set-Cookie"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Routes
import authRoutes from "./routes/auth.js";
import organizationRoutes from "./routes/organizations.js";
import documentRoutes from "./routes/documents.js";
import dashboardRoutes from "./routes/dashboard.js";
import userRoutes from "./routes/users.js";
import contractRoutes from "./routes/contractsV3.js";
import invoiceRoutes from "./routes/invoicesV3.js";
import receiptRoutes from "./routes/receiptsV3.js";
import documentGenerationRoutes from "./routes/documentGeneration.js";
import auditLogRoutes from "./routes/auditLogs.js";
import ticketRoutes from "./routes/tickets.js";
import notificationRoutes from "./routes/notifications.js";

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.path}`);
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);
app.use("/api/v3/contracts", contractRoutes);
app.use("/api/v3/invoices", invoiceRoutes);
app.use("/api/v3/receipts", receiptRoutes);
app.use("/api/v3/documents", documentGenerationRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "CMP Backend is running",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    status: "error",
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  // Do not accept requests or start database-backed jobs until MongoDB is ready.
  await connectDB();
  startRemindersCron();
  startInvoiceStatusCron();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
