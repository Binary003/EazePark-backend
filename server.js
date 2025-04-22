require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");  // ✅ Only declare once
const bcrypt = require("bcryptjs");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: ['https://eazepark.vercel.app', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// ✅ Secure MySQL Connection (Connection Pool)
const db = mysql.createPool({
    host: process.env.DB_HOST || "ba8ze4phhew3hkhiwiog-mysql.services.clever-cloud.com",
    user: process.env.DB_USER || "uifrqzurykjlcpps",
    password: process.env.DB_PASSWORD,  // Ensure this is set in .env
    database: process.env.DB_NAME || "ba8ze4phhew3hkhiwiog",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// ✅ Test Database Connection
db.getConnection()
    .then(() => console.log("✅ MySQL Connected Successfully"))
    .catch((err) => console.error("🔥 MySQL Connection Error:", err));




// ✅ Function to get location name from lat/lon
const getLocationName = async (lat, lon) => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
        const response = await fetch(url);
        const data = await response.json();
        return data.display_name || "Unknown Location";
    } catch (error) {
        console.error("Error fetching location name:", error);
        return "Unknown Location";
    }
};

// ✅ Booking API (Now with user validation & debugging)
app.post("/api/book-parking", async (req, res) => {
    const { userId, userLat, userLon, parkingId, parkingLat, parkingLon } = req.body;
    console.log("Received userId:", userId); // 🔍 Debugging

    if (!userId || !userLat || !userLon || !parkingId || !parkingLat || !parkingLon) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // 🔍 Check if userId exists in users table
        const [userCheck] = await db.execute("SELECT id FROM users WHERE id = ?", [userId]);
        if (userCheck.length === 0) {
            return res.status(400).json({ error: "User does not exist!" });
        }

        const userLocationName = await getLocationName(userLat, userLon);
        const parkingLocationName = await getLocationName(parkingLat, parkingLon);

        const query = "INSERT INTO ParkingBookings (user_id, user_location, parking_id, parking_location) VALUES (?, ?, ?, ?)";
        const [result] = await db.execute(query, [userId, userLocationName, parkingId, parkingLocationName]);

        res.json({ message: "✅ Booking successful!", bookingId: result.insertId });
    } catch (error) {
        console.error("Error processing booking:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ✅ Signup API with Debugging
app.post("/signup", async (req, res) => {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const [existingUsers] = await db.execute("SELECT * FROM users WHERE email = ? OR phone = ?", [email, phone]);

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: "Email or phone already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.execute("INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)", 
                                         [name, email, phone, hashedPassword]);
        console.log("User created with ID:", result.insertId); // 🔍 Debugging
        
        res.json({ message: "✅ Signup successful!", userId: result.insertId });
    } catch (error) {
        console.error("Database error (Signup):", error);
        res.status(500).json({ error: "Error creating user" });
    }
});

app.post("/login", async (req, res) => {
    const { emailOrPhone, password } = req.body;

    // ✅ Validate Input
    if (!emailOrPhone || !password) {
        return res.status(400).json({ error: "Email/Phone and Password are required" });
    }

    try {
        // ✅ Query to check if user exists
        const query = "SELECT id, password FROM users WHERE email = ? OR phone = ?";
        console.log("Executing Query:", query, "with values:", emailOrPhone);

        const [results] = await db.execute(query, [emailOrPhone, emailOrPhone]);
        console.log("Query Result:", results);

        // ✅ Check if user exists
        if (!results || results.length === 0) {
            return res.status(401).json({ error: "Account not found. Please sign up!" });
        }

        const user = results[0]; // ✅ Extract first user
        console.log("User found:", user);

        // ✅ Check if password exists in DB
        if (!user.password) {
            return res.status(500).json({ error: "User password is missing in database" });
        }

        // ✅ Compare Password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Incorrect password" });
        }

        console.log("User logged in successfully:", user.id);
        res.json({ message: "✅ Login successful", userId: user.id });

    } catch (error) {
        console.error("🔥 Database error (Login):", error);
        res.status(500).json({ error: "Database error", details: error.message });
    }
});


// ✅ Start Server
const PORT = process.env.PORT || 3306;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
