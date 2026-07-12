// cart.js — client-side cart stored in localStorage

const CART_KEY = "cart_items"; // [{product_id, name, price, image_url, quantity}]

function getCart() {
  const raw = localStorage.getItem(CART_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  updateCartBadge();
}

function addToCart(product, quantity = 1) {
  const items = getCart();
  const existing = items.find((i) => i.product_id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity,
    });
  }
  saveCart(items);
  showToast(`Added "${product.name}" to cart`);
}

function updateCartQuantity(productId, quantity) {
  let items = getCart();
  if (quantity <= 0) {
    items = items.filter((i) => i.product_id !== productId);
  } else {
    const item = items.find((i) => i.product_id === productId);
    if (item) item.quantity = quantity;
  }
  saveCart(items);
}

function removeFromCart(productId) {
  const items = getCart().filter((i) => i.product_id !== productId);
  saveCart(items);
}

function clearCart() { saveCart([]); }

function cartTotal() {
  return getCart().reduce((sum, i) => sum + i.price * i.quantity, 0);
}

function cartCount() {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}

function updateCartBadge() {
  const badge = document.getElementById("cart-count");
  if (badge) badge.textContent = cartCount();
}

document.addEventListener("DOMContentLoaded", updateCartBadge);
