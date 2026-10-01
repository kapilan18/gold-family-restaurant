const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Order = require("../models/Order");
const { isConfigured, createRazorpayOrder, verifyPaymentSignature } = require("../services/razorpayService");

const router = express.Router();

const getOptionalUser = (req) => {
    try {
        const header = req.headers.authorization;
        if (header?.startsWith("Bearer ")) return jwt.verify(header.slice(7), process.env.JWT_SECRET).userId;
    } catch {
        // Guests may place orders; an invalid token is not trusted.
    }
    return null;
};

const validateCheckout = (body) => {
    const { customerName, customerEmail, customerPhone, orderType, deliveryAddress, items, specialRequests, paymentAttemptId } = body || {};
    if (!customerName || !customerEmail || !customerPhone || !Array.isArray(items) || items.length === 0) {
        return { error: "Please provide contact details and at least one item." };
    }
    if (!["Delivery", "Takeaway", "Dine In"].includes(orderType)) return { error: "Please select a valid order type." };
    if (orderType === "Delivery" && !deliveryAddress?.trim()) return { error: "Delivery address is required for delivery orders." };
    if (typeof paymentAttemptId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(paymentAttemptId)) {
        return { error: "Invalid payment attempt. Please try again." };
    }
    const validItems = items.every(item => item && typeof item.name === "string" && item.name.trim() &&
        Number.isFinite(Number(item.price)) && Number(item.price) >= 0 &&
        Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0);
    if (!validItems) return { error: "Each order item must include a valid name, price, and quantity." };

    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const deliveryCharge = orderType === "Delivery" && subtotal < 600 ? 50 : 0;
    return {
        customerName: customerName.trim(), customerEmail: customerEmail.trim().toLowerCase(), customerPhone: customerPhone.trim(),
        orderType, deliveryAddress: deliveryAddress?.trim() || "", specialRequests: specialRequests?.trim() || "", paymentAttemptId,
        items: items.map(item => ({ name: item.name.trim(), price: Number(item.price), quantity: Number(item.quantity) })),
        subtotal, deliveryCharge, total: subtotal + deliveryCharge
    };
};

router.post("/create-order", async (req, res) => {
    if (!isConfigured()) return res.status(503).json({ success: false, message: "Online payments are not configured." });
    const checkout = validateCheckout(req.body);
    if (checkout.error) return res.status(400).json({ success: false, message: checkout.error });

    try {
        const existing = await Order.findOne({ paymentAttemptId: checkout.paymentAttemptId });
        if (existing) {
            if (existing.customerEmail !== checkout.customerEmail || existing.customerPhone !== checkout.customerPhone || existing.paymentStatus !== "Pending") {
                return res.status(409).json({ success: false, message: "This payment attempt cannot be reused." });
            }
            return res.json({ success: true, keyId: process.env.RAZORPAY_KEY_ID, razorpayOrder: { id: existing.razorpayOrderId, amount: existing.total * 100, currency: "INR" } });
        }

        const razorpayOrder = await createRazorpayOrder({ amount: Math.round(checkout.total * 100), receipt: checkout.paymentAttemptId });
        const order = await Order.create({
            ...checkout,
            user: getOptionalUser(req),
            orderNumber: `GLD-ORD-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
            paymentMethod: "UPI",
            paymentStatus: "Pending",
            razorpayOrderId: razorpayOrder.id,
            status: "Payment Pending"
        });
        return res.status(201).json({ success: true, keyId: process.env.RAZORPAY_KEY_ID, orderNumber: order.orderNumber, razorpayOrder: { id: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency } });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: "A payment attempt is already in progress." });
        console.error("Razorpay order creation error:", error.message);
        return res.status(502).json({ success: false, message: "Could not start the UPI payment. Please try again." });
    }
});

router.post("/verify", async (req, res) => {
    if (!isConfigured()) return res.status(503).json({ success: false, message: "Online payments are not configured." });
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId, razorpay_signature: razorpaySignature } = req.body || {};
    if (![razorpayOrderId, razorpayPaymentId, razorpaySignature].every(value => typeof value === "string" && value.trim())) {
        return res.status(400).json({ success: false, message: "Incomplete Razorpay payment response." });
    }
    if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
        return res.status(400).json({ success: false, message: "Payment signature verification failed." });
    }
    try {
        const order = await Order.findOne({ razorpayOrderId });
        if (!order) return res.status(404).json({ success: false, message: "Payment order was not found." });
        if (order.paymentStatus === "Paid") {
            if (order.razorpayPaymentId !== razorpayPaymentId) return res.status(409).json({ success: false, message: "This order was already paid." });
            return res.json({ success: true, order });
        }
        if (order.paymentStatus !== "Pending") return res.status(409).json({ success: false, message: "This payment can no longer be completed." });

        order.paymentStatus = "Paid";
        order.razorpayPaymentId = razorpayPaymentId;
        order.paymentTimestamp = new Date();
        order.status = "Confirmed";
        await order.save();
        return res.json({ success: true, message: "Payment verified and order confirmed.", order });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: "This Razorpay payment was already used." });
        console.error("Razorpay verification error:", error.message);
        return res.status(500).json({ success: false, message: "Payment verification could not be completed." });
    }
});

module.exports = router;
