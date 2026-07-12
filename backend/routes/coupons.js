const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../config/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// POST /api/coupons/validate  { code, total }
router.post(
  "/validate",
  requireAuth,
  [
    body("code").trim().notEmpty().withMessage("Coupon code is required"),
    body("total").isFloat({ min: 0 }).withMessage("Order subtotal is required"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { code, total } = req.body;
    const coupon = db.prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").get(code.toUpperCase());

    if (!coupon) {
      return res.status(404).json({ error: "Invalid or inactive coupon code" });
    }

    if (total < coupon.min_total) {
      return res.status(400).json({
        error: `Coupon requires a minimum order subtotal of $${coupon.min_total.toFixed(2)}`,
      });
    }

    let discount = 0;
    if (coupon.discount_type === "percentage") {
      discount = (total * coupon.value) / 100;
    } else if (coupon.discount_type === "fixed") {
      discount = coupon.value;
    }

    discount = Math.min(discount, total);

    res.json({
      code: coupon.code,
      discount_type: coupon.discount_type,
      value: coupon.value,
      discount_amount: discount,
      new_total: total - discount,
    });
  }
);

// Admin: GET /api/coupons
router.get("/", requireAuth, requireAdmin, (req, res) => {
  const coupons = db.prepare("SELECT * FROM coupons ORDER BY created_at DESC").all();
  res.json({ coupons });
});

// Admin: POST /api/coupons
router.post(
  "/",
  requireAuth,
  requireAdmin,
  [
    body("code").trim().notEmpty().toUpperCase(),
    body("discount_type").isIn(["percentage", "fixed"]),
    body("value").isFloat({ min: 0.01 }),
    body("min_total").optional().isFloat({ min: 0 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { code, discount_type, value, min_total = 0 } = req.body;

    try {
      const info = db
        .prepare(
          "INSERT INTO coupons (code, discount_type, value, min_total) VALUES (?, ?, ?, ?)"
        )
        .run(code, discount_type, value, min_total);

      const coupon = db.prepare("SELECT * FROM coupons WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json({ coupon });
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "Coupon code already exists" });
      }
      res.status(500).json({ error: "Failed to create coupon" });
    }
  }
);

// Admin: DELETE /api/coupons/:id
router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM coupons WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Coupon not found" });
  res.status(204).send();
});

module.exports = router;
