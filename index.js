require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./src/config/database");
const { User, Otp, Chat, Message } = require("./src/models/index");
const userRoutes = require("./src/routes/user.routes");
const chatRoutes = require("./src/routes/chat.routes");
const passport = require("passport");
require("./src/controllers/passport");
const socialRoutes = require("./src/routes/social.routes");

const app = express();

// ✅ Allowed domains
const allowedOrigins = [
  "http://localhost:8080",
  "http://192.168.18.24:8080",
  "https://biomelc.com",
  "https://chat.biomelc.com"
];

// ✅ CORS
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow tools without origin (Postman, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ CORS blocked for:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ JSON Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Auth
app.use(passport.initialize());

// ✅ Static
app.use("/uploads", express.static("uploads"));

// ✅ Test Route
app.get("/", (req, res) => {
  console.log("Origin:", req.headers.origin);
  res.send("🚀 Node + Express + MySQL is running!");
});

// ✅ API Routes
app.use("/api/users", userRoutes);
app.use("/api", chatRoutes);
app.use("/api/social-login", socialRoutes);


// ✅ Start
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected!");

    await sequelize.sync({ alter: true });
    console.log("✅ Tables synced!");

    app.listen(process.env.PORT, () => {
      console.log(`🔥 Server running: http://localhost:${process.env.PORT}`);
    });
  } catch (err) {
    console.error("❌ DB Error:", err);
  }
})();
