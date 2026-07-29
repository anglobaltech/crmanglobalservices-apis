require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

// Suppress node-cron "missed execution" warnings that appear after
// the computer wakes from sleep/hibernate — they are harmless.
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

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.get("/", (req, res) => {
  res.send("Backend working");
});

let consecutiveFailures = 0;
let nextAllowedRunTime = 0;

const autoFetchTradeIndiaLeads = async () => {
  const now = Date.now();
  if (now < nextAllowedRunTime) {
    return; // Silently skip during backoff period
  }

  try {
    console.log("Auto fetching TradeIndia leads...");
    await importExternalLeads();
    console.log("TradeIndia lead sync completed");
    
    // Reset on success
    consecutiveFailures = 0;
    nextAllowedRunTime = 0;
  } catch (error) {
    consecutiveFailures++;
    // Exponential backoff: 5m, 10m, 20m, 40m... max 2 hours
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

// Global Error Handler must be the last middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});