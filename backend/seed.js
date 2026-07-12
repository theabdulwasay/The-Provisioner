require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./config/db");

console.log("Seeding database...");

db.exec("DELETE FROM reviews; DELETE FROM order_items; DELETE FROM orders; DELETE FROM products; DELETE FROM categories; DELETE FROM users; DELETE FROM wishlist; DELETE FROM coupons;");

const insertUser = db.prepare(
  "INSERT INTO users (name, email, password_hash, role, phone, default_address) VALUES (?, ?, ?, ?, ?, ?)"
);
insertUser.run("Admin User", "admin@shop.com", bcrypt.hashSync("admin123", 10), "admin", "+1 (555) 0100", "100 Executive Way, Metropolis");
const customerInfo = insertUser.run("Jane Customer", "jane@example.com", bcrypt.hashSync("password123", 10), "customer", "+1 (555) 0199", "789 Evergreen Terrace, Springfield");
const customerId = customerInfo.lastInsertRowid;

const categories = ["Electronics", "Home & Kitchen", "Apparel", "Books", "Sports & Outdoors"];
const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
const categoryIds = {};
for (const name of categories) {
  const info = insertCategory.run(name);
  categoryIds[name] = info.lastInsertRowid;
}

const products = [
  ["Wireless Headphones", "Noise-cancelling over-ear headphones with 30h battery life.", 89.99, 40, "Electronics"],
  ["Mechanical Keyboard", "RGB backlit mechanical keyboard with hot-swappable switches.", 64.5, 25, "Electronics"],
  ["4K Webcam", "1080p/4K USB webcam with autofocus, great for streaming.", 49.99, 30, "Electronics"],
  ["Stainless Steel Cookware Set", "10-piece stainless steel pots and pans set.", 129.0, 15, "Home & Kitchen"],
  ["Espresso Machine", "15-bar pump espresso machine with milk frother.", 199.99, 10, "Home & Kitchen"],
  ["Ceramic Knife Set", "5-piece ultra-sharp ceramic kitchen knife set.", 34.99, 50, "Home & Kitchen"],
  ["Classic Denim Jacket", "Unisex classic-fit denim jacket.", 54.0, 60, "Apparel"],
  ["Running Shoes", "Lightweight breathable running shoes.", 74.99, 45, "Apparel"],
  ["Merino Wool Sweater", "Soft, breathable merino wool crew-neck sweater.", 68.0, 35, "Apparel"],
  ["Atomic Habits", "Bestselling book on building good habits.", 16.99, 100, "Books"],
  ["The Pragmatic Programmer", "Classic software engineering reference.", 39.99, 40, "Books"],
  ["Deep Work", "Book on focused success in a distracted world.", 15.5, 80, "Books"],
  ["Yoga Mat", "Non-slip eco-friendly yoga mat, 6mm thick.", 28.0, 70, "Sports & Outdoors"],
  ["Adjustable Dumbbell Set", "5-50 lb adjustable dumbbell pair.", 249.99, 12, "Sports & Outdoors"],
  ["Camping Tent (4-Person)", "Waterproof 4-person dome camping tent.", 119.0, 20, "Sports & Outdoors"],
];

const insertProduct = db.prepare(
  `INSERT INTO products (name, description, price, stock, image_url, category_id)
   VALUES (?, ?, ?, ?, ?, ?)`
);

const productIds = [];
for (const [name, description, price, stock, category] of products) {
  const seedImg = `https://picsum.photos/seed/${encodeURIComponent(name)}/400/300`;
  const info = insertProduct.run(name, description, price, stock, seedImg, categoryIds[category]);
  productIds.push(info.lastInsertRowid);
}

// Seed some reviews
const insertReview = db.prepare(
  "INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)"
);
insertReview.run(productIds[0], customerId, 5, "Incredible sound quality! Noise cancelling works perfectly on my daily commute.");
insertReview.run(productIds[0], customerId, 4, "Very comfortable, though battery life is closer to 28 hours in my experience.");
insertReview.run(productIds[1], customerId, 5, "Tactile, clicky switches are satisfying to type on. Bright, customizable RGB backlight is a major plus.");
insertReview.run(productIds[9], customerId, 5, "A life-changing book. The practical advice on atomic shifts is easy to follow.");
insertReview.run(productIds[10], customerId, 4, "A classic read for junior and senior engineers alike. Lots of great tips.");

// Seed some coupons
const insertCoupon = db.prepare(
  "INSERT INTO coupons (code, discount_type, value, min_total, active) VALUES (?, ?, ?, ?, 1)"
);
insertCoupon.run("SAVE10", "percentage", 10, 20); // 10% off, min order $20
insertCoupon.run("FLAT15", "fixed", 15, 50);      // $15 off, min order $50
insertCoupon.run("WELCOME5", "fixed", 5, 0);      // $5 off, no minimum
insertCoupon.run("SALE25", "percentage", 25, 100); // 25% off, min order $100

console.log(`Seeded ${categories.length} categories, ${products.length} products, 5 reviews, and 4 coupons.`);
console.log("Login as admin: admin@shop.com / admin123");
console.log("Login as customer: jane@example.com / password123");
