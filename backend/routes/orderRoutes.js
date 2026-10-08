const express = require("express");
const Order = require("../models/Order");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const router = express.Router();

const getOptionalUser = (req) => {
    try {
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer ")
        ) {
            const token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return decoded.userId;
        }
    } catch {
        // Guest user
    }

    return null;
};

// =====================================
// PLACE ORDER
// =====================================
router.post("/", async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            customerPhone,
            orderType,
            deliveryAddress,
            items,
            paymentMethod,
            specialRequests
        } = req.body || {};

        // Basic validation
        if (
            !customerName ||
            !customerEmail ||
            !customerPhone ||
            !items ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please provide your contact details and at least one item in the order."
            });
        }

        // Delivery address validation
        if (
            orderType === "Delivery" &&
            (!deliveryAddress || !deliveryAddress.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Delivery address is required for delivery orders."
            });
        }

        // Order type validation
        if (
            orderType &&
            !["Delivery", "Takeaway", "Dine In"].includes(orderType)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid order type."
            });
        }

        // Payment method validation
        if (
            paymentMethod &&
            ![
                "Cash on Delivery",
                "UPI",
                "Debit/Credit Card",
                "Bank Transfer"
            ].includes(paymentMethod)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid payment method."
            });
        }

        // Online payment protection
        // Do not mark an order as paid without gateway verification.
        if (["UPI", "Bank Transfer"].includes(paymentMethod)) {
            return res.status(503).json({
                success: false,
                message:
                    "Online payments are temporarily unavailable. Please use Cash on Delivery."
            });
        }

        // Validate order items
        const validItems = items.every(
            (item) =>
                item &&
                typeof item.name === "string" &&
                item.name.trim() &&
                Number.isFinite(Number(item.price)) &&
                Number(item.price) >= 0 &&
                Number.isInteger(Number(item.quantity)) &&
                Number(item.quantity) > 0
        );

        if (!validItems) {
            return res.status(400).json({
                success: false,
                message:
                    "Each order item must include a valid name, price, and quantity."
            });
        }

        // Calculate totals
        const subtotal = items.reduce(
            (sum, item) =>
                sum +
                Number(item.price) *
                    (Number(item.quantity) || 1),
            0
        );

        const deliveryCharge =
            orderType === "Delivery" ? 50 : 0;

        const total = subtotal + deliveryCharge;

        // Optional logged-in user
        const userId = getOptionalUser(req);

        // Generate order number
        const orderNumber = `GLD-ORD-${Math.floor(
            100000 + Math.random() * 900000
        )}`;

        // Create order
        const order = await Order.create({
            user: userId,
            orderNumber,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim().toLowerCase(),
            customerPhone: customerPhone.trim(),
            orderType: orderType || "Delivery",
            deliveryAddress: deliveryAddress
                ? deliveryAddress.trim()
                : "",
            items: items.map((item) => ({
                name: item.name,
                price: Number(item.price),
                quantity: Number(item.quantity) || 1
            })),
            subtotal,
            deliveryCharge,
            total,
            paymentMethod:
                paymentMethod || "Cash on Delivery",
            specialRequests: specialRequests
                ? specialRequests.trim()
                : "",
            status: "Confirmed"
        });

        return res.status(201).json({
            success: true,
            message: "Order placed successfully!",
            order
        });
    } catch (error) {
        console.error("Create Order Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to place order. Please try again."
        });
    }
});

// =====================================
// ADMIN / OWNER - GET ALL ORDERS
// =====================================
router.get("/admin", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        // Check Authorization header
        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        let decoded;

        // Verify JWT
        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired login session."
            });
        }

        // Get logged-in user role
        const user = await User.findById(
            decoded.userId
        ).select("role");

        // Only ADMIN and OWNER can access all orders
        if (
            !user ||
            !["ADMIN", "OWNER"].includes(user.role)
        ) {
            return res.status(403).json({
                success: false,
                message: "Admin or owner access required."
            });
        }

        // Get latest 100 orders
        const orders = await Order.find({})
            .sort({ createdAt: -1 })
            .limit(100);

        return res.json({
            success: true,
            orders
        });
    } catch (error) {
        console.error(
            "Admin Get Orders Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve admin orders."
        });
    }
});

// =====================================
// GET USER'S ORDERS
// =====================================
router.get("/my", async (req, res) => {
    try {
        const userId = getOptionalUser(req);
        const { phone } = req.query;

        let query = {};

        if (userId) {
            query.user = userId;
        } else if (phone) {
            query.customerPhone = phone.trim();
        } else {
            return res.status(400).json({
                success: false,
                message:
                    "Please login or provide your phone number to view order history."
            });
        }

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(20);

        return res.json({
            success: true,
            orders
        });
    } catch (error) {
        console.error(
            "Get Orders Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve orders."
        });
    }
});

// =====================================
// TRACK ORDER BY ORDER NUMBER
// =====================================
router.get(
    "/track/:orderNumber",
    async (req, res) => {
        try {
            const order =
                await Order.findOne({
                    orderNumber:
                        req.params.orderNumber
                            .trim()
                            .toUpperCase()
                });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Order not found with this order number."
                });
            }

            return res.json({
                success: true,
                order
            });
        } catch (error) {
            console.error(
                "Track Order Error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Error retrieving order details."
            });
        }
    }
);

module.exports = router;