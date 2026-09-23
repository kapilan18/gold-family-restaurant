const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1
    }
});

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false
        },
        orderNumber: {
            type: String,
            required: true,
            unique: true
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
        orderType: {
            type: String,
            enum: ["Delivery", "Takeaway", "Dine In"],
            default: "Delivery"
        },
        deliveryAddress: {
            type: String,
            default: ""
        },
        items: [orderItemSchema],
        subtotal: {
            type: Number,
            required: true
        },
        deliveryCharge: {
            type: Number,
            default: 0
        },
        total: {
            type: Number,
            required: true
        },
        paymentMethod: {
            type: String,
            enum: ["Cash on Delivery", "UPI", "Debit/Credit Card", "Bank Transfer"],
            default: "Cash on Delivery"
        },
        specialRequests: {
            type: String,
            default: ""
        },
        status: {
            type: String,
            enum: ["Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"],
            default: "Confirmed"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Order", orderSchema);
