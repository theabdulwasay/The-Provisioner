const express = require("express");
const db = require("../config/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/stats", (req, res) => {
  const totalRevenue = db
    .prepare("SELECT COALESCE(SUM(total),0) AS sum FROM orders WHERE status != 'cancelled'")
    .get().sum;
  const totalOrders = db.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
  const totalCustomers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='customer'").get().count;
  const totalProducts = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  const lowStock = db.prepare("SELECT id, name, stock FROM products WHERE stock <= 5 ORDER BY stock ASC").all();

  const revenueByDay = db
    .prepare(
      `SELECT date(created_at) AS day, SUM(total) AS revenue, COUNT(*) AS orders
       FROM orders WHERE status != 'cancelled'
       GROUP BY day ORDER BY day DESC LIMIT 30`
    )
    .all();

  const topProducts = db
    .prepare(
      `SELECT p.name, SUM(oi.quantity) AS units_sold, SUM(oi.quantity * oi.unit_price) AS revenue
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       GROUP BY p.id ORDER BY revenue DESC LIMIT 5`
    )
    .all();

  res.json({ totalRevenue, totalOrders, totalCustomers, totalProducts, lowStock, revenueByDay, topProducts });
});

module.exports = router;
