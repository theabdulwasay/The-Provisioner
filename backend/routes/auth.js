const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const db = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const password_hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')")
      .run(name, email.toLowerCase(), password_hash);

    const user = db.prepare("SELECT id, name, email, role, phone, default_address FROM users WHERE id = ?").get(info.lastInsertRowid);
    const token = signToken(user);
    res.status(201).json({ token, user });
  }
);

router.post(
  "/login",
  [body("email").isEmail(), body("password").notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, default_address: user.default_address } });
  }
);

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id, name, email, role, phone, default_address, created_at FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

router.put(
  "/profile",
  requireAuth,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("phone").optional().trim(),
    body("default_address").optional().trim(),
    body("password").optional().custom(value => {
      if (value && value.length > 0 && value.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      return true;
    }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, phone, default_address, password } = req.body;
    const existing = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email.toLowerCase(), req.user.id);
    if (existing) return res.status(409).json({ error: "Email already in use by another account" });

    if (password) {
      const password_hash = bcrypt.hashSync(password, 10);
      db.prepare(
        "UPDATE users SET name = ?, email = ?, phone = ?, default_address = ?, password_hash = ? WHERE id = ?"
      ).run(name, email.toLowerCase(), phone || null, default_address || null, password_hash, req.user.id);
    } else {
      db.prepare(
        "UPDATE users SET name = ?, email = ?, phone = ?, default_address = ? WHERE id = ?"
      ).run(name, email.toLowerCase(), phone || null, default_address || null, req.user.id);
    }

    const user = db.prepare("SELECT id, name, email, role, phone, default_address, created_at FROM users WHERE id = ?").get(req.user.id);
    const token = signToken(user);
    res.json({ user, token });
  }
);

module.exports = router;
