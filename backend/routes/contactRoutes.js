const express = require("express");
const Contact = require("../models/Contact");

const router = express.Router();

// =====================================
// SUBMIT CONTACT MESSAGE
// =====================================
router.post("/", async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields (Name, Email, Subject, Message)."
            });
        }

        const contact = await Contact.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone ? phone.trim() : "",
            subject: subject.trim(),
            message: message.trim()
        });

        return res.status(201).json({
            success: true,
            message: "Thank you for contacting Gold Restaurant! Your message has been received.",
            contact
        });
    } catch (error) {
        console.error("Contact API Error:", error);
        return res.status(500).json({
            success: false,
            message: "Could not send message. Please call us directly at 091594 224449."
        });
    }
});

module.exports = router;
