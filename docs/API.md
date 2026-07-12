# API Reference

Base URL: `http://localhost:4000/api`

All request/response bodies are JSON. Authenticated routes require:
`Authorization: Bearer <token>`

## Auth

| Method | Route              | Auth | Description                     |
|--------|---------------------|------|----------------------------------|
| POST   | `/auth/register`    | —    | Create an account, returns token |
| POST   | `/auth/login`       | —    | Log in, returns token            |
| GET    | `/auth/me`          | ✅   | Get the current user             |

**Register/Login body:** `{ "name", "email", "password" }` (name only on register)

## Products

| Method | Route                     | Auth        | Description                          |
|--------|---------------------------|-------------|----------------------------------------|
| GET    | `/products`               | —           | List products (search/filter/sort/paginate) |
| GET    | `/products/categories`    | —           | List all categories                    |
| GET    | `/products/:id`           | —           | Get one product + its reviews          |
| POST   | `/products`               | admin       | Create a product                       |
| PUT    | `/products/:id`           | admin       | Update a product                       |
| DELETE | `/products/:id`           | admin       | Delete a product                       |
| POST   | `/products/:id/reviews`   | ✅          | Add a review `{ rating, comment }`      |

**Query params for `GET /products`:** `search`, `category`, `minPrice`, `maxPrice`,
`sort` (`price_asc`|`price_desc`|`newest`|`name_asc`), `page`, `limit`

## Orders

| Method | Route                    | Auth   | Description                             |
|--------|---------------------------|--------|-------------------------------------------|
| POST   | `/orders`                 | ✅     | Place an order `{ items: [{product_id, quantity}], shipping_address }` |
| GET    | `/orders`                 | ✅     | List the current user's orders           |
| GET    | `/orders/:id`              | ✅     | Get one order (owner or admin)           |
| GET    | `/orders/admin/all`        | admin  | List every order                          |
| PATCH  | `/orders/:id/status`       | admin  | Update order status `{ status }`          |

Order placement is transactional: stock is validated and decremented atomically;
insufficient stock rolls back the whole order with a `400`.

## Admin

| Method | Route            | Auth  | Description                                  |
|--------|-------------------|-------|-------------------------------------------------|
| GET    | `/admin/stats`    | admin | Revenue, order/customer/product counts, low-stock alerts, 30-day revenue trend, top 5 products |

## Error format

```json
{ "error": "Human readable message" }
```
or, for validation failures:
```json
{ "errors": [{ "msg": "Valid email is required", "path": "email", ... }] }
```
