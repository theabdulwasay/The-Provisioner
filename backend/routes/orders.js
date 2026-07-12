const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../config/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// POST /api/orders  { items: [{product_id, quantity}], shipping_address, coupon_code }
router.post(
  "/",
  requireAuth,
  [
    body("items").isArray({ min: 1 }).withMessage("Order must contain at least one item"),
    body("items.*.product_id").isInt({ min: 1 }).withMessage("Each item must include a valid product_id"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Each item must include a quantity of at least 1"),
    body("shipping_address").trim().notEmpty().withMessage("Shipping address is required"),
    body("coupon_code").optional().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { items, shipping_address, coupon_code } = req.body;
    const couponCode = coupon_code?.trim().toUpperCase();

    const createOrder = db.transaction(() => {
      let subtotal = 0;
      const resolvedItems = [];

      for (const item of items) {
        const product = db.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id);
        if (!product) throw { status: 404, message: `Product ${item.product_id} not found` };
        if (product.stock < item.quantity) {
          throw { status: 400, message: `Insufficient stock for ${product.name}` };
        }
        subtotal += product.price * item.quantity;
        resolvedItems.push({ product, quantity: item.quantity });
      }

      let discount = 0;
      let appliedCoupon = null;
      if (coupon_code) {
        const coupon = db.prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").get(coupon_code.toUpperCase());
        if (!coupon) {
          throw { status: 400, message: "Invalid or inactive coupon code" };
        }
        if (subtotal < coupon.min_total) {
          throw { status: 400, message: `Coupon requires a minimum order subtotal of $${coupon.min_total.toFixed(2)}` };
        }
        if (coupon.discount_type === "percentage") {
          discount = (subtotal * coupon.value) / 100;
        } else if (coupon.discount_type === "fixed") {
          discount = coupon.value;
        }
        discount = Math.min(discount, subtotal); // Discount cannot exceed subtotal
        appliedCoupon = coupon.code;
      }

      const total = subtotal - discount;

      const orderInfo = db
        .prepare("INSERT INTO orders (user_id, total, shipping_address, status, coupon_code, discount_applied) VALUES (?, ?, ?, 'pending', ?, ?)")
        .run(req.user.id, total, shipping_address, appliedCoupon, discount);

      const orderId = orderInfo.lastInsertRowid;

      const insertItem = db.prepare(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)"
      );
      const decrementStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");

      for (const { product, quantity } of resolvedItems) {
        insertItem.run(orderId, product.id, quantity, product.price);
        decrementStock.run(quantity, product.id);
      }

      return orderId;
    });

    try {
      const orderId = createOrder();
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
      const orderItems = db
        .prepare(
          `SELECT oi.*, p.name AS product_name FROM order_items oi
           JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`
        )
        .all(orderId);
      res.status(201).json({ order, items: orderItems });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Failed to create order" });
    }
  }
);

// GET /api/orders  (current user's orders)
router.get("/", requireAuth, (req, res) => {
  const orders = db
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.user.id);
  res.json({ orders });
});

// Admin: list all orders
router.get("/admin/all", requireAuth, requireAdmin, (req, res) => {
  const orders = db
    .prepare(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC`
    )
    .all();
  res.json({ orders });
});

router.get("/:id", requireAuth, (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Not authorized to view this order" });
  }
  const items = db
    .prepare(
      `SELECT oi.*, p.name AS product_name FROM order_items oi
       JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`
    )
    .all(req.params.id);
  res.json({ order, items });
});

// Admin: update order status
router.patch("/:id/status", requireAuth, requireAdmin, [body("status").isIn([
  "pending", "paid", "shipped", "delivered", "cancelled",
])], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(req.body.status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Order not found" });

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  res.json({ order });
});

module.exports = router;
