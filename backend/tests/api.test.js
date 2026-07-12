const request = require("supertest");
const fs = require("fs");
const path = require("path");

process.env.DB_PATH = path.join(__dirname, "test.db");
process.env.JWT_SECRET = "test_secret";

const dbPath = process.env.DB_PATH;
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const app = require("../server");

let token;
let productId;

afterAll(() => {
  const db = require("../config/db");
  db.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  ["-wal", "-shm"].forEach((suffix) => {
    const f = dbPath + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe("Health check", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("Auth flow", () => {
  it("registers a new user", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  it("rejects duplicate email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User 2",
      email: "test@example.com",
      password: "password123",
    });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "password123",
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("rejects bad credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "wrongpass",
    });
    expect(res.status).toBe(401);
  });
});

describe("Products", () => {
  it("creates a product as admin (manually promoted)", async () => {
    // Promote test user to admin directly via DB for this test
    const db = require("../config/db");
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run("test@example.com");

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "password123",
    });
    token = loginRes.body.token;

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test Widget", price: 19.99, stock: 10 });

    expect(res.status).toBe(201);
    expect(res.body.product.name).toBe("Test Widget");
    productId = res.body.product.id;
  });

  it("lists products", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
  });

  it("rejects product creation without auth", async () => {
    const res = await request(app).post("/api/products").send({ name: "No Auth", price: 5, stock: 1 });
    expect(res.status).toBe(401);
  });
});

describe("Orders", () => {
  it("creates an order and decrements stock", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product_id: productId, quantity: 2 }], shipping_address: "123 Test St" });

    expect(res.status).toBe(201);
    expect(res.body.order.total).toBeCloseTo(39.98, 2);
  });

  it("rejects order exceeding stock", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product_id: productId, quantity: 999 }], shipping_address: "123 Test St" });

    expect(res.status).toBe(400);
  });

  it("lists the user's own orders", async () => {
    const res = await request(app).get("/api/orders").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThan(0);
  });
});

describe("Coupons", () => {
  it("creates a coupon as admin (manually created in db for test)", () => {
    const db = require("../config/db");
    // Ensure table matches
    db.prepare("INSERT OR IGNORE INTO coupons (code, discount_type, value, min_total, active) VALUES ('TEST20', 'percentage', 20, 10, 1)").run();
  });

  it("validates a coupon code", async () => {
    const res = await request(app)
      .post("/api/coupons/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "TEST20", total: 100 });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("TEST20");
    expect(res.body.discount_amount).toBe(20);
    expect(res.body.new_total).toBe(80);
  });

  it("rejects coupon code if min total is not met", async () => {
    const res = await request(app)
      .post("/api/coupons/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "TEST20", total: 5 });
    expect(res.status).toBe(400);
  });
});

describe("Wishlist", () => {
  it("adds a product to wishlist", async () => {
    const res = await request(app)
      .post("/api/wishlist")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId });
    expect(res.status).toBe(201);
  });

  it("lists items in wishlist", async () => {
    const res = await request(app)
      .get("/api/wishlist")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.wishlist.length).toBeGreaterThan(0);
    expect(res.body.wishlist[0].product_id).toBe(productId);
  });

  it("removes product from wishlist", async () => {
    const res = await request(app)
      .delete(`/api/wishlist/${productId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
