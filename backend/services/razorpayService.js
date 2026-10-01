const crypto = require("crypto");

const isConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const createRazorpayOrder = async ({ amount, receipt }) => {
    const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ amount, currency: "INR", receipt }),
        signal: AbortSignal.timeout(15000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id) {
        throw new Error(data.error?.description || "Razorpay could not create a payment order.");
    }
    return data;
};

const verifyPaymentSignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

    const supplied = Buffer.from(razorpaySignature || "", "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
};

module.exports = { isConfigured, createRazorpayOrder, verifyPaymentSignature };
