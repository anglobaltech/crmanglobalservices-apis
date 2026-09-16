require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const _warn = console.warn.bind(console);
console.warn = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("NODE-CRON") && args[0].includes("missed")) return;
  _warn(...args);
};

const errorHandler = require("./middleware/errorHandler");

const {
  importExternalLeads,
} = require("./controllers/leadController");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const leadRoutes = require("./routes/leadRoutes");
const salesRoutes = require("./routes/salesRoutes");
const activityRoutes = require("./routes/activityRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const projectRoutes = require("./routes/projectRoutes");
const stockRoutes = require("./routes/stockRoutes");
const employeeRoutes = require("./routes/employeeRoutes");

const app = express();

const corsOptions = {
  origin: ["https://crm.anglobalservices.com", "http://localhost:3000"],
  optionsSuccessStatus: 200
};
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: "Too many requests from this IP, please try again after 15 minutes"
});
app.use("/api", limiter);
app.get("/", (req, res) => {
  res.send("Backend working");
});

let consecutiveFailures = 0;
let nextAllowedRunTime = 0;

const autoFetchTradeIndiaLeads = async () => {
  const now = Date.now();
  if (now < nextAllowedRunTime) {
    return;
  }

  try {
    console.log("Auto fetching TradeIndia leads...");
    await importExternalLeads();
    console.log("TradeIndia lead sync completed");
    
    consecutiveFailures = 0;
    nextAllowedRunTime = 0;
  } catch (error) {
    consecutiveFailures++;
    const backoffMinutes = Math.min(5 * Math.pow(2, consecutiveFailures - 1), 120);
    nextAllowedRunTime = now + backoffMinutes * 60 * 1000;
    
    console.error(`TradeIndia Auto Fetch Error (${consecutiveFailures} failures). Backing off for ${backoffMinutes} minutes. Error:`, error.message);
  }
};

autoFetchTradeIndiaLeads();
cron.schedule("*/5 * * * *", async () => {
  await autoFetchTradeIndiaLeads();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/employees", employeeRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});