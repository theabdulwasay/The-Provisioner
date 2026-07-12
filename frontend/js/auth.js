// auth.js — shared nav rendering based on login state

function renderNav() {
  const nav = document.getElementById("nav-links");
  if (!nav) return;
  const user = getCurrentUser();
  const path = window.location.pathname;
  const page = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

  const checkActive = (name) => page === name ? 'class="active"' : '';

  let links = `<a href="index.html" ${checkActive('index.html')}>Shop</a>`;
  
  if (user) {
    links += `<a href="wishlist.html" ${checkActive('wishlist.html')}>Wishlist</a>`;
    links += `<a href="orders.html" ${checkActive('orders.html')}>My Orders</a>`;
    links += `<a href="profile.html" ${checkActive('profile.html')}>Profile</a>`;
    if (user.role === "admin") links += `<a href="admin.html" ${checkActive('admin.html')}>Admin</a>`;
  } else {
    links += `<a href="wishlist.html" ${checkActive('wishlist.html')}>Wishlist</a>`;
  }
  
  links += `<a href="cart.html" ${checkActive('cart.html')}>Cart<span class="cart-badge" id="cart-count">0</span></a>`;

  if (user) {
    links += `<a href="#" id="logout-link">Log out (${user.name.split(" ")[0]})</a>`;
  } else {
    links += `<a href="login.html" ${checkActive('login.html')}>Log in</a>`;
    links += `<a href="register.html" class="btn btn-sm">Sign up</a>`;
  }

  const preferred = getPreferredTheme();
  links += `<button class="theme-toggle-btn" onclick="toggleTheme()" aria-label="Toggle theme">${preferred === "dark" ? "☀️" : "🌙"}</button>`;

  nav.innerHTML = links;
  updateCartBadge();

  const logoutLink = document.getElementById("logout-link");
  if (logoutLink) logoutLink.addEventListener("click", (e) => { e.preventDefault(); logout(); });
}

function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

function requireAdmin() {
  if (!isLoggedIn() || !isAdmin()) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}
