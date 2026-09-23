// Configure DNS servers for reliable MongoDB SRV lookups on Windows
const dns = require("dns");
try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
    console.warn("Could not set custom DNS servers:", e.message);
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ================================
// MIDDLEWARE
// ================================
app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(express.json());

// ================================
// HEALTH CHECK ROUTE
// ================================
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Gold Restaurant Luxury API is running smoothly.",
        database: mongoose.connection.readyState === 1 ? "Connected" : "Connecting/Disconnected"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
    });
});

// ================================
// API ROUTES
// ================================
const authRoutes = require("./routes/authRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const orderRoutes = require("./routes/orderRoutes");
const contactRoutes = require("./routes/contactRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/contact", contactRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack);
    res.status(500).json({
        success: false,
        message: "An internal server error occurred."
    });
});

// ================================
// DATABASE CONNECTION & SERVER START
// ================================
console.log("Connecting to MongoDB Atlas...");
mongoose
    .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 8000
    })
    .then(() => {
        console.log("✓ MongoDB Atlas connected successfully");
    })
    .catch((error) => {
        console.error("✗ MongoDB connection failed:", error.message);
        console.log("Continuing server execution in offline/fallback mode.");
    });

app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`  🌟 Gold Restaurant Server running on http://localhost:${PORT}`);
    console.log(`  ✓ Auth API:         http://localhost:${PORT}/api/auth`);
    console.log(`  ✓ Reservations API: http://localhost:${PORT}/api/reservations`);
    console.log(`  ✓ Orders API:       http://localhost:${PORT}/api/orders`);
    console.log(`  ✓ Contact API:      http://localhost:${PORT}/api/contact`);
    console.log(`=================================================\n`);
});
