const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../config/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/products?search=&category=&minPrice=&maxPrice=&sort=price_asc&page=1&limit=12
router.get("/", (req, res) => {
  const { search, category, minPrice, maxPrice, sort, page = 1, limit = 12 } = req.query;

  let query = `
    SELECT p.*, c.name AS category_name,
           (SELECT ROUND(AVG(rating), 2) FROM reviews r WHERE r.product_id = p.id) AS avg_rating,
           (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const params = [];

  let countQuery = `
    SELECT COUNT(*) AS count
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const countParams = [];

  if (search) {
    const searchFilter = " AND (p.name LIKE ? OR p.description LIKE ?)";
    query += searchFilter;
    countQuery += searchFilter;
    params.push(`%${search}%`, `%${search}%`);
    countParams.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    const categoryFilter = " AND c.name = ?";
    query += categoryFilter;
    countQuery += categoryFilter;
    params.push(category);
    countParams.push(category);
  }
  if (minPrice) {
    const minPriceFilter = " AND p.price >= ?";
    query += minPriceFilter;
    countQuery += minPriceFilter;
    params.push(Number(minPrice));
    countParams.push(Number(minPrice));
  }
  if (maxPrice) {
    const maxPriceFilter = " AND p.price <= ?";
    query += maxPriceFilter;
    countQuery += maxPriceFilter;
    params.push(Number(maxPrice));
    countParams.push(Number(maxPrice));
  }

  const sortMap = {
    price_asc: "p.price ASC",
    price_desc: "p.price DESC",
    newest: "p.created_at DESC",
    name_asc: "p.name ASC",
  };
  query += ` ORDER BY ${sortMap[sort] || "p.created_at DESC"}`;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const offset = (pageNum - 1) * limitNum;
  query += " LIMIT ? OFFSET ?";
  params.push(limitNum, offset);

  const products = db.prepare(query).all(...params);
  const total = db.prepare(countQuery).get(...countParams).count;

  res.json({ products, page: pageNum, limit: limitNum, total });
});

router.get("/categories", (req, res) => {
  const categories = db.prepare("SELECT * FROM categories ORDER BY name").all();
  res.json({ categories });
});

// Admin: POST /api/products/categories
router.post(
  "/categories",
  requireAuth,
  requireAdmin,
  [body("name").trim().notEmpty().withMessage("Category name is required")],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
      const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json({ category });
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "Category already exists" });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  }
);

// Admin: DELETE /api/products/categories/:id
router.delete("/categories/:id", requireAuth, requireAdmin, (req, res) => {
  try {
    const result = db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: "Category not found" });
    res.status(204).send();
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      return res.status(400).json({ error: "Cannot delete category containing products. Reassign them first." });
    }
    res.status(500).json({ error: "Failed to delete category" });
  }
});

router.get("/:id", (req, res) => {
  const product = db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
    )
    .get(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const reviews = db
    .prepare(
      `SELECT r.*, u.name AS user_name FROM reviews r
       JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.created_at DESC`
    )
    .all(req.params.id);

  res.json({ product, reviews });
});

router.post(
  "/",
  requireAuth,
  requireAdmin,
  [
    body("name").trim().notEmpty(),
    body("price").isFloat({ min: 0 }),
    body("stock").isInt({ min: 0 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description = "", price, stock, image_url = "", category_id = null } = req.body;
    const info = db
      .prepare(
        `INSERT INTO products (name, description, price, stock, image_url, category_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(name, description, price, stock, image_url, category_id);
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ product });
  }
);

router.put("/:id", requireAuth, requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found" });

  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE products SET name=?, description=?, price=?, stock=?, image_url=?, category_id=? WHERE id=?`
  ).run(merged.name, merged.description, merged.price, merged.stock, merged.image_url, merged.category_id, req.params.id);

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  res.json({ product });
});

router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Product not found" });
  res.status(204).send();
});

// Reviews
router.post(
  "/:id/reviews",
  requireAuth,
  [body("rating").isInt({ min: 1, max: 5 }), body("comment").optional().trim()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const product = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const { rating, comment = "" } = req.body;
    const info = db
      .prepare("INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)")
      .run(req.params.id, req.user.id, rating, comment);

    const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ review });
  }
);

module.exports = router;
