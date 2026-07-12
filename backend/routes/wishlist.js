const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/wishlist
router.get("/", (req, res) => {
  const wishlist = db
    .prepare(
      `SELECT w.product_id, p.name, p.price, p.image_url, p.stock, c.name AS category_name,
              (SELECT ROUND(AVG(rating), 2) FROM reviews r WHERE r.product_id = p.id) AS avg_rating,
              (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
       FROM wishlist w
       JOIN products p ON p.id = w.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE w.user_id = ? ORDER BY w.created_at DESC`
    )
    .all(req.user.id);
  res.json({ wishlist });
});

// POST /api/wishlist
router.post(
  "/",
  [body("product_id").isInt({ min: 1 }).withMessage("product_id is required and must be a positive integer")],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { product_id } = req.body;
    const product = db.prepare("SELECT id FROM products WHERE id = ?").get(product_id);
    if (!product) return res.status(404).json({ error: "Product not found" });

  try {
    db.prepare("INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)").run(req.user.id, product_id);
    res.status(201).json({ message: "Product added to wishlist" });
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Product already in wishlist" });
    }
    res.status(500).json({ error: "Failed to add to wishlist" });
  }
});

// DELETE /api/wishlist/:productId
router.delete("/:productId", (req, res) => {
  const result = db.prepare("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?").run(req.user.id, req.params.productId);
  if (result.changes === 0) return res.status(404).json({ error: "Item not found in wishlist" });
  res.json({ message: "Product removed from wishlist" });
});

module.exports = router;
