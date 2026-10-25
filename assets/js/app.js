// REPLACE WITH YOUR GOOGLE APPS SCRIPT WEB APP URL
const API_URL = "https://script.google.com/macros/s/AKfycbz4ESWZEST-Gnl8LzloIVP6uK7FrlhTADNvOczuCJLNBWQF1TooKT8vrE5RNuQFZMQ_8g/exec";
const PAYSTACK_PUBLIC_KEY = "pk_test_xxxxxxxxxxxxxxxxxxxxxxxx";

// Theme Switcher Initialization
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}
if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
}

// Local Cart helpers
function getCart() {
    return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const cart = getCart();
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    if (badge) badge.innerText = totalCount;
}

// Fetch and Render Products + Dynamic Settings
async function loadStoreData() {
    const grid = document.getElementById('product-grid');
    const loading = document.getElementById('loading');
    
    try {
        // FIXED: Use Promise.all() to fetch both concurrently
        const [prodRes, settingsRes] = await Promise.all([
            fetch(`${API_URL}?action=getProducts`).then(r => r.json()),
            fetch(`${API_URL}?action=getSettings`).then(r => r.json())
        ]);
        
        if (loading) loading.style.display = 'none';

        // Apply settings if available
        if (settingsRes.status === "success" && settingsRes.data) {
            let s = settingsRes.data;
            if (s.storeName && document.getElementById('store-title')) {
                document.getElementById('store-title').innerText = "🛍️ " + s.storeName;
            }
            if (s.whatsapp && document.getElementById('whatsapp-widget')) {
                document.getElementById('whatsapp-widget').href = `https://wa.me/${s.whatsapp}?text=Hello,%20I%20have%20an%20inquiry%20about%20your%20products.`;
            }
        }

        if (prodRes.status === "success" && prodRes.data.length > 0) {
            grid.innerHTML = prodRes.data.map(p => `
                <div class="product-card">
                    <img src="${p.imageUrl || 'https://via.placeholder.com/250'}" alt="${p.title}">
                    <div class="product-info">
                        <div>
                            <h3>${p.title}</h3>
                            <p>${p.description}</p>
                        </div>
                        <div>
                            <div class="price">GHS ${parseFloat(p.price).toFixed(2)}</div>
                            <div class="stock-badge">📦 Only ${p.stock} left in stock</div>
                            <button onclick='addToCart(${JSON.stringify(p)})'>Add to Cart</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            if (grid) grid.innerHTML = "<p>No products available right now.</p>";
        }
    } catch (err) {
        if (loading) loading.innerText = "Failed to load store data. Check your API URL.";
        console.error(err);
    }
}

function addToCart(product) {
    let cart = getCart();
    let existing = cart.find(item => item.id === product.id);
    if (existing) {
        if (existing.quantity >= product.stock) {
            alert("Cannot add more than available stock!");
            return;
        }
        existing.quantity += 1;
    } else {
        if (product.stock <= 0) {
            alert("Product is out of stock!");
            return;
        }
        cart.push({ ...product, quantity: 1 });
    }
    saveCart(cart);
    alert(`${product.title} added to cart!`);
}

// Render Cart Page
function renderCartPage() {
    const container = document.getElementById('cart-items');
    const checkoutSection = document.getElementById('checkout-section');
    if (!container) return;

    let cart = getCart();
    if (cart.length === 0) {
        container.innerHTML = "<p>Your cart is empty.</p>";
        if (checkoutSection) checkoutSection.style.display = 'none';
        return;
    }

    if (checkoutSection) checkoutSection.style.display = 'block';

    let total = 0;
    container.innerHTML = `
        <table style="width:100%; border-collapse: collapse; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
            <thead>
                <tr style="background: var(--border-color); text-align: left;">
                    <th style="padding: 15px;">Item</th>
                    <th style="padding: 15px;">Price</th>
                    <th style="padding: 15px;">Quantity</th>
                    <th style="padding: 15px;">Total</th>
                    <th style="padding: 15px;">Action</th>
                </tr>
            </thead>
            <tbody>
                ${cart.map((item, index) => {
                    let subtotal = item.price * item.quantity;
                    total += subtotal;
                    return `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 15px;">${item.title}</td>
                            <td style="padding: 15px;">GHS ${parseFloat(item.price).toFixed(2)}</td>
                            <td style="padding: 15px;">${item.quantity}</td>
                            <td style="padding: 15px;">GHS ${subtotal.toFixed(2)}</td>
                            <td style="padding: 15px;"><button onclick="removeFromCart(${index})" style="background: #e74c3c; padding: 6px 12px;">Remove</button></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        <h3 style="margin-top: 20px; text-align: right;">Grand Total: GHS ${total.toFixed(2)}</h3>
    `;
}

function removeFromCart(index) {
    let cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    renderCartPage();
}

// Handle Checkout Form & Paystack Trigger
const checkoutForm = document.getElementById('checkout-form');
if (checkoutForm) {
    checkoutForm.addEventListener('submit', function(e) {
        e.preventDefault();
        let cart = getCart();
        if (cart.length === 0) return alert("Your cart is empty!");

        let name = document.getElementById('cust-name').value;
        let email = document.getElementById('cust-email').value;
        let phone = document.getElementById('cust-phone').value;

        let totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let amountInKobo = Math.round(totalAmount * 100);

        let handler = PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: email,
            amount: amountInKobo,
            currency: 'GHS',
            callback: function(response) {
                submitOrderToBackend({
                    action: "createOrder",
                    customerName: name,
                    customerEmail: email,
                    customerPhone: phone,
                    items: cart,
                    totalAmount: totalAmount,
                    paystackRef: response.reference
                });
            },
            onClose: function() {
                alert('Transaction was not completed.');
            }
        });
        handler.openIframe();
    });
}

async function submitOrderToBackend(orderData) {
    try {
        let res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(orderData)
        });
        let result = await res.json();
        if (result.status === "success") {
            alert("Order placed successfully! Check your email for your receipt.");
            localStorage.removeItem('cart');
            window.location.href = "index.html";
        } else {
            alert("Order placed via payment, but database save failed: " + result.message);
        }
    } catch (err) {
        console.error(err);
        alert("Error saving order to database.");
    }
}

// Initialize
updateCartCount();
if (document.getElementById('product-grid')) {
    loadStoreData();
}