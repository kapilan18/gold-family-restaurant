const express = require("express");
const Reservation = require("../models/Reservation");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const router = express.Router();

// =====================================
// HELPER: OPTIONAL USER
// =====================================
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
        // Guest user or expired token
    }

    return null;
};

// =====================================
// HELPER: ADMIN / OWNER AUTHORIZATION
// =====================================
const requireAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId).select("role name email");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User account not found."
            });
        }

        if (user.role !== "ADMIN" && user.role !== "OWNER") {
            return res.status(403).json({
                success: false,
                message: "Admin or Owner access required."
            });
        }

        req.adminUser = user;
        next();
    } catch (error) {
        console.error("Reservation Admin Auth Error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token."
        });
    }
};

// =====================================
// CREATE RESERVATION
// =====================================
router.post("/", async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            customerPhone,
            reservationDate,
            reservationTime,
            guests,
            seatingArea,
            occasion,
            specialRequests
        } = req.body || {};

        if (
            !customerName ||
            !customerEmail ||
            !customerPhone ||
            !reservationDate ||
            !reservationTime ||
            !guests
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please provide all required fields (Name, Email, Phone, Date, Time, Number of Guests)."
            });
        }

        const guestCount = Number(guests);

        const requestedDate = new Date(`${reservationDate}T00:00:00`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (
            Number.isNaN(requestedDate.getTime()) ||
            requestedDate < today ||
            !Number.isInteger(guestCount) ||
            guestCount < 1 ||
            guestCount > 50
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please provide a valid reservation date and guest count (1–50)."
            });
        }

        const userId = getOptionalUser(req);

        const bookingReference = `GLD-RES-${Math.floor(
            100000 + Math.random() * 900000
        )}`;

        const reservation = await Reservation.create({
            user: userId,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim().toLowerCase(),
            customerPhone: customerPhone.trim(),
            reservationDate,
            reservationTime,
            guests: guestCount,
            seatingArea: seatingArea || "Royal Gold Lounge",
            occasion: occasion || "Casual Dining",
            specialRequests: specialRequests || "",
            bookingReference,
            status: "Confirmed"
        });

        return res.status(201).json({
            success: true,
            message: "Table reservation confirmed successfully!",
            reservation
        });
    } catch (error) {
        console.error("Create Reservation Error:", error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to book table. Please try again or call 091594 224449."
        });
    }
});

// =====================================
// ADMIN: GET ALL RESERVATIONS
// =====================================
router.get("/admin", requireAdmin, async (req, res) => {
    try {
        const reservations = await Reservation.find({})
            .sort({ createdAt: -1 })
            .limit(100);

        return res.json({
            success: true,
            count: reservations.length,
            reservations
        });
    } catch (error) {
        console.error("Get Admin Reservations Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve reservations."
        });
    }
});

// =====================================
// GET USER'S RESERVATIONS
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
                    "Please login or provide your phone number to check reservations."
            });
        }

        const reservations = await Reservation.find(query)
            .sort({ createdAt: -1 })
            .limit(20);

        return res.json({
            success: true,
            reservations
        });
    } catch (error) {
        console.error("Get Reservations Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve reservations."
        });
    }
});

// =====================================
// GET RESERVATION BY REFERENCE
// =====================================
router.get("/track/:reference", async (req, res) => {
    try {
        const reservation = await Reservation.findOne({
            bookingReference: req.params.reference.trim().toUpperCase()
        });

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: "Reservation not found with this reference ID."
            });
        }

        return res.json({
            success: true,
            reservation
        });
    } catch (error) {
        console.error("Track Reservation Error:", error);

        return res.status(500).json({
            success: false,
            message: "Error finding reservation."
        });
    }
});

module.exports = router;