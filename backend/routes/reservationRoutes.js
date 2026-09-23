const express = require("express");
const Reservation = require("../models/Reservation");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Helper to optionally get user from Bearer token without rejecting guests
const getOptionalUser = (req) => {
    try {
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            const token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return decoded.userId;
        }
    } catch {
        // Guest user or token expired
    }
    return null;
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
        } = req.body;

        if (!customerName || !customerEmail || !customerPhone || !reservationDate || !reservationTime || !guests) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields (Name, Email, Phone, Date, Time, Number of Guests)."
            });
        }

        const userId = getOptionalUser(req);
        const bookingReference = `GLD-RES-${Math.floor(100000 + Math.random() * 900000)}`;

        const reservation = await Reservation.create({
            user: userId,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim().toLowerCase(),
            customerPhone: customerPhone.trim(),
            reservationDate,
            reservationTime,
            guests: Number(guests),
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
            message: "Failed to book table. Please try again or call 091594 224449."
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
                message: "Please login or provide your phone number to check reservations."
            });
        }

        const reservations = await Reservation.find(query).sort({ createdAt: -1 }).limit(20);

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
        return res.status(500).json({
            success: false,
            message: "Error finding reservation."
        });
    }
});

module.exports = router;
