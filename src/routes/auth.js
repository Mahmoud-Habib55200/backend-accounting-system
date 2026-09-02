const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { register, login, me, forgotPassword, resetPassword } = require("../controllers/authController");
const auth = require("../middleware/auth");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 20,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", register);
router.post("/login", loginLimiter, login);
router.get("/me", auth, me);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
