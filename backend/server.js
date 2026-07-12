const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
if (!process.env.JWT_SECRET) {
  console.error("Missing required environment variable JWT_SECRET");
  process.exit(1);
}
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");
const wishlistRoutes = require("./routes/wishlist");
const couponRoutes = require("./routes/coupons");

const app = express();

app.use(cors());
app.use(express.json());

const path = require("path");

// Serve frontend static files from ../frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Root → redirect to frontend index
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../frontend/index.html"))
);

app.get("/api", (req, res) =>
  res.json({
    message: "Use the /api/* endpoints for auth, products, orders, admin, wishlist, and coupons.",
    health: "/api/health",
  })
);

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/coupons", couponRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
}

module.exports = app;
