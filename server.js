require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

const {
  importExternalLeads,
} = require("./controllers/leadController");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const leadRoutes = require("./routes/leadRoutes");
const salesRoutes = require("./routes/salesRoutes");
const activityRoutes = require("./routes/activityRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend working");
});

const autoFetchTradeIndiaLeads = async () => {
  try {
    console.log(
      "Auto fetching TradeIndia leads..."
    );

    await importExternalLeads();

    console.log(
      "TradeIndia lead sync completed"
    );
  } catch (error) {
    console.error(
      "TradeIndia Auto Fetch Error:",
      error.message
    );
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});