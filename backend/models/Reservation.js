const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false
        },
        customerName: {
            type: String,
            required: true,
            trim: true
        },
        customerEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        customerPhone: {
            type: String,
            required: true,
            trim: true
        },
        reservationDate: {
            type: String,
            required: true
        },
        reservationTime: {
            type: String,
            required: true
        },
        guests: {
            type: Number,
            required: true,
            min: 1,
            max: 50
        },
        seatingArea: {
            type: String,
            enum: [
                "Royal Gold Lounge",
                "Main Family Dining",
                "Garden Rooftop",
                "Private VIP Suite"
            ],
            default: "Royal Gold Lounge"
        },
        occasion: {
            type: String,
            default: "Casual Dining"
        },
        specialRequests: {
            type: String,
            trim: true,
            default: ""
        },
        bookingReference: {
            type: String,
            required: true,
            unique: true
        },
        status: {
            type: String,
            enum: ["Confirmed", "Pending", "Cancelled", "Completed"],
            default: "Confirmed"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Reservation", reservationSchema);
