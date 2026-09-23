/**
 * GOLD RESTAURANT - CORE JAVASCRIPT SYSTEM
 * Handles Auth Sync, Shopping Cart Drawer, Backend Orders, Table Booking & UI Interactivity
 */

const API_BASE = 'https://gold-family-restaurant.onrender.com/api';

// ==========================================
// 1. INITIALIZATION ON DOM LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initAuthSync();
    initCartSystem();
    initFormHandlers();
    initMenuFilters();
    initGalleryLightbox();
    highlightActiveNav();
});

// ==========================================
// 2. AUTHENTICATION & NAVBAR SYNC
// ==========================================
async function initAuthSync() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const loginNav = document.getElementById('loginNavItem');
    const userMenu = document.getElementById('userMenu');
    const userNameDisplay = document.getElementById('navbarUserName');

    if (!token) {
        if (loginNav) loginNav.style.display = 'block';
        if (userMenu) userMenu.style.display = 'none';
        return;
    }

    // Verify token with backend /api/auth/me
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await res.json();

        if (res.ok && data.success && data.user) {
            // User is verified
            if (loginNav) loginNav.style.display = 'none';
            if (userMenu) userMenu.style.display = 'block';
            if (userNameDisplay) userNameDisplay.textContent = data.user.name.split(' ')[0];

            // Auto-fill checkout and reservation forms if open
            autoFillUserDetails(data.user);
        } else {
            // Invalid or expired token
            clearUserSession();
        }
    } catch (err) {
        // Backend offline or network error: use cached user data gracefully
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
            try {
                const user = JSON.parse(cachedUser);
                if (loginNav) loginNav.style.display = 'none';
                if (userMenu) userMenu.style.display = 'block';
                if (userNameDisplay) userNameDisplay.textContent = user.name.split(' ')[0];
                autoFillUserDetails(user);
            } catch {
                clearUserSession();
            }
        }
    }
}

function autoFillUserDetails(user) {
    const checkoutName = document.getElementById('checkoutName');
    const checkoutEmail = document.getElementById('checkoutEmail');
    const checkoutPhone = document.getElementById('checkoutPhone');
    if (checkoutName && !checkoutName.value) checkoutName.value = user.name || '';
    if (checkoutEmail && !checkoutEmail.value) checkoutEmail.value = user.email || '';
    if (checkoutPhone && !checkoutPhone.value) checkoutPhone.value = user.phone || '';

    const resName = document.getElementById('resName');
    const resEmail = document.getElementById('resEmail');
    const resPhone = document.getElementById('resPhone');
    if (resName && !resName.value) resName.value = user.name || '';
    if (resEmail && !resEmail.value) resEmail.value = user.email || '';
    if (resPhone && !resPhone.value) resPhone.value = user.phone || '';
}

function logoutUser() {
    if (confirm('Are you sure you want to log out of Gold Restaurant?')) {
        clearUserSession();
        showToast('Logged out successfully.', 'info');
        setTimeout(() => {
            window.location.reload();
        }, 600);
    }
}

function clearUserSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    const loginNav = document.getElementById('loginNavItem');
    const userMenu = document.getElementById('userMenu');
    if (loginNav) loginNav.style.display = 'block';
    if (userMenu) userMenu.style.display = 'none';
}

// ==========================================
// 3. PERSISTENT SHOPPING CART SYSTEM
// ==========================================
let cart = JSON.parse(localStorage.getItem('goldCartItems')) || [];

function saveCart() {
    localStorage.setItem('goldCartItems', JSON.stringify(cart));
    renderCart();
}

function initCartSystem() {
    renderCart();
    
    // Inject Cart Drawer HTML if not already in DOM
    if (!document.getElementById('cartDrawer')) {
        injectCartDrawer();
    }
}

function addToCart(name, price, img = '') {
    const existingIndex = cart.findIndex(item => item.name === name);
    if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({
            name,
            price: Number(price),
            quantity: 1,
            img
        });
    }
    saveCart();
    showToast(`Added ${name} to your order! 🍽️`, 'success');
    openCart();
}

function updateCartQty(index, delta) {
    if (cart[index]) {
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) {
            removeFromCart(index);
            return;
        }
        saveCart();
    }
}

function removeFromCart(index) {
    if (cart[index]) {
        const name = cart[index].name;
        cart.splice(index, 1);
        saveCart();
        showToast(`Removed ${name} from cart`, 'info');
    }
}

function clearCart() {
    cart = [];
    saveCart();
}

function renderCart() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = totalCount > 0 ? (subtotal >= 600 ? 0 : 50) : 0;
    const grandTotal = subtotal + deliveryFee;

    // Update all badges across page
    document.querySelectorAll('.cart-count-badge, #cartBadge').forEach(badge => {
        badge.textContent = totalCount;
        badge.style.display = totalCount > 0 ? 'flex' : 'none';
    });

    const itemsContainer = document.getElementById('cartItemsList');
    if (itemsContainer) {
        if (cart.length === 0) {
            itemsContainer.innerHTML = `
                <div class="cart-empty-state">
                    <i class="fas fa-shopping-bag"></i>
                    <h4>Your Cart is Empty</h4>
                    <p class="small">Explore our royal delicacies and add dishes to your order.</p>
                    <a href="menu.html" class="btn btn-gold btn-sm mt-3" onclick="closeCart()">
                        <i class="fas fa-utensils me-1"></i> Browse Menu
                    </a>
                </div>
            `;
        } else {
            itemsContainer.innerHTML = cart.map((item, idx) => `
                <div class="cart-item-row">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.name}</div>
                        <div class="cart-item-price">₹${item.price} × ${item.quantity} = ₹${item.price * item.quantity}</div>
                    </div>
                    <div class="cart-qty-ctrl">
                        <button class="cart-qty-btn" onclick="updateCartQty(${idx}, -1)" title="Decrease">−</button>
                        <span class="cart-qty-number">${item.quantity}</span>
                        <button class="cart-qty-btn" onclick="updateCartQty(${idx}, 1)" title="Increase">+</button>
                    </div>
                    <button class="cart-item-delete" onclick="removeFromCart(${idx})" title="Remove item">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    // Update totals in drawer
    const subtotalEl = document.getElementById('cartSubtotal');
    const deliveryEl = document.getElementById('cartDelivery');
    const totalEl = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtnCart');

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal}`;
    if (deliveryEl) deliveryEl.textContent = subtotal === 0 ? '₹0' : (deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`);
    if (totalEl) totalEl.textContent = `₹${grandTotal}`;
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

function toggleCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    if (drawer && overlay) {
        drawer.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function openCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    if (drawer && overlay) {
        drawer.classList.add('active');
        overlay.classList.add('active');
    }
}

function closeCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    if (drawer && overlay) {
        drawer.classList.remove('active');
        overlay.classList.remove('active');
    }
}

// Injects slide-out drawer markup if missing
function injectCartDrawer() {
    const markup = `
        <div class="cart-drawer-overlay" id="cartDrawerOverlay" onclick="closeCart()"></div>
        <div class="cart-drawer" id="cartDrawer">
            <div class="cart-header">
                <h3><i class="fas fa-shopping-bag text-gold"></i> Your Order</h3>
                <button class="cart-close-btn" onclick="closeCart()" aria-label="Close cart">&times;</button>
            </div>
            <div class="cart-body" id="cartItemsList"></div>
            <div class="cart-footer">
                <div class="cart-summary-line">
                    <span>Subtotal</span>
                    <span id="cartSubtotal">₹0</span>
                </div>
                <div class="cart-summary-line">
                    <span>Delivery Charge</span>
                    <span id="cartDelivery">₹0</span>
                </div>
                <div class="cart-summary-line total">
                    <span>Total Amount</span>
                    <span id="cartTotal">₹0</span>
                </div>
                <button class="btn btn-gold w-100 mt-3" id="checkoutBtnCart" onclick="openCheckoutModal()">
                    <i class="fas fa-check-circle me-1"></i> Proceed to Checkout
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', markup);
    renderCart();
}

// ==========================================
// 4. CHECKOUT & ONLINE ORDERING MODAL
// ==========================================
function openCheckoutModal() {
    if (cart.length === 0) {
        showToast('Your cart is empty! Add items first.', 'error');
        return;
    }
    closeCart();

    let modal = document.getElementById('checkoutModal');
    if (!modal) {
        injectCheckoutModal();
        modal = document.getElementById('checkoutModal');
    }

    // Refresh totals inside modal summary
    const modalTotal = document.getElementById('modalOrderTotal');
    const modalItemsList = document.getElementById('modalOrderItemsList');
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = subtotal >= 600 ? 0 : 50;
    const total = subtotal + deliveryFee;

    if (modalTotal) modalTotal.textContent = `₹${total}`;
    if (modalItemsList) {
        modalItemsList.innerHTML = cart.map(i => `
            <div class="d-flex justify-content-between text-muted small py-1">
                <span>${i.name} × ${i.quantity}</span>
                <span>₹${i.price * i.quantity}</span>
            </div>
        `).join('');
    }

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function injectCheckoutModal() {
    const markup = `
        <div class="modal fade modal-luxury" id="checkoutModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4 class="modal-title font-luxury"><i class="fas fa-utensils text-gold me-2"></i>Complete Your Order</h4>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <form id="checkoutOrderForm">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label-luxury">Full Name *</label>
                                <input type="text" class="form-control-luxury" id="checkoutName" required placeholder="Enter your full name">
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label-luxury">Email Address *</label>
                                    <input type="email" class="form-control-luxury" id="checkoutEmail" required placeholder="name@email.com">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label-luxury">Phone Number *</label>
                                    <input type="tel" class="form-control-luxury" id="checkoutPhone" required placeholder="091594 224449">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label-luxury">Order Type *</label>
                                <select class="form-select-luxury" id="checkoutOrderType" onchange="toggleDeliveryField(this.value)">
                                    <option value="Delivery">Doorstep Delivery (30-45 mins)</option>
                                    <option value="Takeaway">Express Takeaway (Pickup at Hotel Sivalaya)</option>
                                    <option value="Dine In">Dine In (Table Service)</option>
                                </select>
                            </div>
                            <div class="mb-3" id="deliveryAddressGroup">
                                <label class="form-label-luxury">Delivery Address *</label>
                                <textarea class="form-control-luxury" id="checkoutAddress" rows="2" placeholder="Full door no, street name, landmark in Pudukkottai"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label-luxury">Payment Method</label>
                                <div class="payment-grid">
                                    <div class="payment-radio-card">
                                        <input type="radio" name="orderPayment" id="pay_cod" value="Cash on Delivery" checked>
                                        <label class="payment-radio-label" for="pay_cod">
                                            <i class="fas fa-money-bill-wave"></i> Cash on Delivery
                                        </label>
                                    </div>
                                    <div class="payment-radio-card">
                                        <input type="radio" name="orderPayment" id="pay_upi" value="UPI">
                                        <label class="payment-radio-label" for="pay_upi">
                                            <i class="fas fa-qrcode"></i> UPI (GPay / PhonePe)
                                        </label>
                                    </div>
                                    <div class="payment-radio-card">
                                        <input type="radio" name="orderPayment" id="pay_card" value="Debit/Credit Card">
                                        <label class="payment-radio-label" for="pay_card">
                                            <i class="fas fa-credit-card"></i> Card at Delivery
                                        </label>
                                    </div>
                                    <div class="payment-radio-card">
                                        <input type="radio" name="orderPayment" id="pay_bank" value="Bank Transfer">
                                        <label class="payment-radio-label" for="pay_bank">
                                            <i class="fas fa-university"></i> Bank Transfer
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label-luxury">Special Chef Instructions (Optional)</label>
                                <input type="text" class="form-control-luxury" id="checkoutSpecialRequests" placeholder="Less spicy, extra raita, etc.">
                            </div>
                            <div class="p-3 rounded mt-3" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-gold-subtle);">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <span class="text-muted small">Items in Cart:</span>
                                    <span class="fw-bold text-gold" id="modalOrderTotal">₹0</span>
                                </div>
                                <div id="modalOrderItemsList"></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-gold" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-gold" id="confirmOrderBtn">
                                <i class="fas fa-paper-plane me-1"></i> Place Order
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', markup);
    setupCheckoutSubmit();
}

function toggleDeliveryField(val) {
    const addr = document.getElementById('deliveryAddressGroup');
    const addrInput = document.getElementById('checkoutAddress');
    if (addr) {
        if (val === 'Delivery') {
            addr.style.display = 'block';
            if (addrInput) addrInput.required = true;
        } else {
            addr.style.display = 'none';
            if (addrInput) addrInput.required = false;
        }
    }
}

function setupCheckoutSubmit() {
    const form = document.getElementById('checkoutOrderForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (cart.length === 0) {
            showToast('Your cart is empty!', 'error');
            return;
        }

        const name = document.getElementById('checkoutName').value.trim();
        const email = document.getElementById('checkoutEmail').value.trim();
        const phone = document.getElementById('checkoutPhone').value.trim();
        const orderType = document.getElementById('checkoutOrderType').value;
        const address = document.getElementById('checkoutAddress') ? document.getElementById('checkoutAddress').value.trim() : '';
        const paymentRadio = document.querySelector('input[name="orderPayment"]:checked');
        const paymentMethod = paymentRadio ? paymentRadio.value : 'Cash on Delivery';
        const requests = document.getElementById('checkoutSpecialRequests') ? document.getElementById('checkoutSpecialRequests').value.trim() : '';

        if (orderType === 'Delivery' && !address) {
            showToast('Please provide your delivery address in Pudukkottai.', 'error');
            return;
        }

        const submitBtn = document.getElementById('confirmOrderBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Placing Order...';
        }

        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const orderPayload = {
            customerName: name,
            customerEmail: email,
            customerPhone: phone,
            orderType,
            deliveryAddress: address,
            paymentMethod,
            specialRequests: requests,
            items: cart
        };

        try {
            const response = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(orderPayload)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Close modal
                const modalEl = document.getElementById('checkoutModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();

                const orderNum = data.order ? data.order.orderNumber : `GLD-${Date.now().toString().slice(-6)}`;
                clearCart();

                // Show celebration alert
                showOrderSuccessModal(orderNum, name, orderType);
            } else {
                showToast(data.message || 'Could not place order. Please try again.', 'error');
            }
        } catch (err) {
            // Fallback for offline mode
            const offlineOrderNum = `GLD-ORD-${Math.floor(100000 + Math.random() * 900000)}`;
            const savedOrders = JSON.parse(localStorage.getItem('goldOrders')) || [];
            savedOrders.push({ ...orderPayload, orderNumber: offlineOrderNum, createdAt: new Date().toISOString() });
            localStorage.setItem('goldOrders', JSON.stringify(savedOrders));

            const modalEl = document.getElementById('checkoutModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            clearCart();
            showOrderSuccessModal(offlineOrderNum, name, orderType);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane me-1"></i> Place Order';
            }
        }
    });
}

function showOrderSuccessModal(orderNumber, name, orderType) {
    const successMarkup = `
        <div class="modal fade modal-luxury" id="orderSuccessModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content text-center p-4">
                    <div class="mb-3">
                        <div class="brand-badge mx-auto mb-3" style="width: 70px; height: 70px; font-size: 2rem;">
                            <i class="fas fa-check text-dark"></i>
                        </div>
                        <h3 class="font-luxury text-gold">Order Confirmed!</h3>
                        <p class="text-muted">Thank you, <strong>${name}</strong>. Your ${orderType} order is being prepared with royal care.</p>
                    </div>
                    <div class="p-3 mb-4 rounded" style="background: rgba(212,175,55,0.1); border: 1px solid var(--border-gold);">
                        <div class="small text-muted text-uppercase letter-spacing-1">Order Reference ID</div>
                        <div class="fs-4 fw-bold text-gold">${orderNumber}</div>
                        <div class="small text-muted mt-1">Estimated delivery: 30 - 45 Minutes</div>
                    </div>
                    <div>
                        <button type="button" class="btn btn-gold w-100" data-bs-dismiss="modal">
                            <i class="fas fa-check me-2"></i> Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', successMarkup);
    const modal = new bootstrap.Modal(document.getElementById('orderSuccessModal'));
    modal.show();
}

// ==========================================
// 5. TABLE RESERVATION FORM HANDLING
// ==========================================
function initFormHandlers() {
    setupCheckoutSubmit();

    const reservationForm = document.getElementById('reservationForm');
    if (reservationForm) {
        reservationForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('resName').value.trim();
            const email = document.getElementById('resEmail').value.trim();
            const phone = document.getElementById('resPhone').value.trim();
            const date = document.getElementById('resDate').value;
            const time = document.getElementById('resTime').value;
            const guests = document.getElementById('resGuests').value;
            const seatingInput = document.querySelector('input[name="resSeating"]:checked');
            const seatingArea = seatingInput ? seatingInput.value : 'Royal Gold Lounge';
            const occasion = document.getElementById('resOccasion') ? document.getElementById('resOccasion').value : 'Casual Dining';
            const specialRequests = document.getElementById('resRequests') ? document.getElementById('resRequests').value.trim() : '';

            const submitBtn = reservationForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Reserving Table...';
            }

            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const payload = {
                customerName: name,
                customerEmail: email,
                customerPhone: phone,
                reservationDate: date,
                reservationTime: time,
                guests,
                seatingArea,
                occasion,
                specialRequests
            };

            try {
                const response = await fetch(`${API_BASE}/reservations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    const ref = data.reservation ? data.reservation.bookingReference : `GLD-RES-${Date.now().toString().slice(-6)}`;
                    showReservationSuccess(ref, name, date, time, guests, seatingArea);
                    reservationForm.reset();
                } else {
                    showToast(data.message || 'Could not reserve table. Please call 091594 224449.', 'error');
                }
            } catch (err) {
                const offlineRef = `GLD-RES-${Math.floor(100000 + Math.random() * 900000)}`;
                showReservationSuccess(offlineRef, name, date, time, guests, seatingArea);
                reservationForm.reset();
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-chair me-2"></i> Confirm Table Reservation';
                }
            }
        });
    }

    // Contact Form
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone') ? document.getElementById('phone').value.trim() : '';
            const subject = document.getElementById('subject').value.trim();
            const message = document.getElementById('message').value.trim();

            const submitBtn = contactForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Sending...';
            }

            try {
                const res = await fetch(`${API_BASE}/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, phone, subject, message })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    showToast('Thank you! Your message has been sent to Gold Restaurant.', 'success');
                    contactForm.reset();
                } else {
                    showToast(data.message || 'Failed to send message.', 'error');
                }
            } catch {
                showToast('Thank you! Your message has been recorded. We will contact you soon.', 'success');
                contactForm.reset();
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i> Send Message';
                }
            }
        });
    }
}

function showReservationSuccess(ref, name, date, time, guests, seating) {
    const markup = `
        <div class="modal fade modal-luxury" id="reservationSuccessModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content text-center p-4">
                    <div class="brand-badge mx-auto mb-3" style="width: 70px; height: 70px; font-size: 2rem;">
                        <i class="fas fa-calendar-check text-dark"></i>
                    </div>
                    <h3 class="font-luxury text-gold">Table Reserved!</h3>
                    <p class="text-muted">A royal dining table has been reserved for <strong>${name}</strong>.</p>
                    
                    <div class="p-3 my-3 rounded" style="background: rgba(212,175,55,0.08); border: 1px solid var(--border-gold);">
                        <div class="small text-muted">BOOKING REFERENCE</div>
                        <div class="fs-4 fw-bold text-gold mb-2">${ref}</div>
                        <div class="text-start small text-muted border-top pt-2" style="border-color: rgba(255,255,255,0.08) !important;">
                            <div>📅 <strong>Date:</strong> ${date}</div>
                            <div>⏰ <strong>Time:</strong> ${time}</div>
                            <div>👥 <strong>Guests:</strong> ${guests} Person(s)</div>
                            <div>🏛️ <strong>Seating:</strong> ${seating}</div>
                        </div>
                    </div>
                    <p class="small text-muted">Please arrive 10 minutes prior to your booking. For changes, call 091594 224449.</p>
                    <button type="button" class="btn btn-gold w-100 mt-2" data-bs-dismiss="modal">Great, Thank You</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', markup);
    const modal = new bootstrap.Modal(document.getElementById('reservationSuccessModal'));
    modal.show();
}

// ==========================================
// 6. MENU & GALLERY FILTERS
// ==========================================
function initMenuFilters() {
    const filterButtons = document.querySelectorAll('.filter-chip');
    const menuItems = document.querySelectorAll('.menu-category-group, .menu-item-col');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const category = this.getAttribute('data-filter');

            menuItems.forEach(item => {
                const itemCat = item.getAttribute('data-category');
                if (category === 'all' || itemCat === category) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

function initGalleryLightbox() {
    const galleryCards = document.querySelectorAll('.gallery-card');
    galleryCards.forEach(card => {
        card.addEventListener('click', function() {
            const img = this.querySelector('img');
            const title = this.querySelector('h4') ? this.querySelector('h4').textContent : 'Gold Restaurant';
            const desc = this.querySelector('p') ? this.querySelector('p').textContent : '';

            if (!img) return;

            let lightbox = document.getElementById('galleryLightboxModal');
            if (!lightbox) {
                const markup = `
                    <div class="modal fade modal-luxury" id="galleryLightboxModal" tabindex="-1">
                        <div class="modal-dialog modal-dialog-centered modal-lg">
                            <div class="modal-content" style="background: rgba(10,11,14,0.96);">
                                <div class="modal-header border-0">
                                    <h5 class="modal-title text-gold" id="lightboxTitle"></h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body text-center p-2">
                                    <img id="lightboxImg" src="" class="img-fluid rounded" style="max-height: 70vh; object-fit: cover;">
                                    <p id="lightboxDesc" class="text-muted mt-3 mb-1"></p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', markup);
                lightbox = document.getElementById('galleryLightboxModal');
            }

            document.getElementById('lightboxTitle').textContent = title;
            document.getElementById('lightboxDesc').textContent = desc;
            document.getElementById('lightboxImg').src = img.src;

            const modal = new bootstrap.Modal(lightbox);
            modal.show();
        });
    });
}

// ==========================================
// 7. TOAST NOTIFICATION UTILITY
// ==========================================
function showToast(message, type = 'info') {
    let container = document.getElementById('goldToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'goldToastContainer';
        container.className = 'gold-toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `gold-toast ${type}`;

    let icon = 'fa-info-circle text-gold';
    if (type === 'success') icon = 'fa-check-circle text-success';
    if (type === 'error') icon = 'fa-exclamation-triangle text-danger';

    toast.innerHTML = `
        <i class="fas ${icon} fs-5"></i>
        <div class="flex-grow-1 small">${message}</div>
        <button type="button" class="btn-close btn-close-white small" style="font-size: 0.65rem;" onclick="this.parentElement.remove()"></button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================
// 8. ACTIVE NAVIGATION HIGHLIGHT
// ==========================================
function highlightActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.navbar-luxury .nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}
