const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { sendPasswordResetEmail } = require("../services/mailer");

// In-memory brute-force tracking: email → { count, blockedUntil }
const loginAttempts = new Map();

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function getBruteForceError(email) {
  const entry = loginAttempts.get(email);
  if (!entry) return null;
  if (entry.blockedUntil && Date.now() < entry.blockedUntil) {
    const remaining = Math.ceil((entry.blockedUntil - Date.now()) / 1000 / 60);
    return `Too many failed attempts. Try again in ${remaining} minute(s).`;
  }
  return null;
}

function recordFailedAttempt(email) {
  const entry = loginAttempts.get(email) ?? { count: 0, blockedUntil: null };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    entry.count = 0;
  }
  loginAttempts.set(email, entry);
}

function clearAttempts(email) {
  loginAttempts.delete(email);
}

function signToken(id, rememberMe = false) {
  const expiresIn = rememberMe ? "30d" : "24h";
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn });
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ success: false, message: "Email already in use" });
    }
    const created = await User.create({ name, email, password });
    const token   = signToken(created._id);
    const user    = await User.findById(created._id);
    res.status(201).json({
      success: true,
      data: { token, user },
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password, rememberMe = false } = req.body;

    const blockError = getBruteForceError(email);
    if (blockError) {
      return res.status(429).json({ success: false, message: blockError });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      recordFailedAttempt(email);
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (user.isSuspended) {
      return res.status(403).json({ success: false, message: "ACCOUNT_SUSPENDED" });
    }

    clearAttempts(email);
    const token = signToken(user._id, rememberMe);

    // Re-fetch without password select to get the clean full document
    const fullUser = await User.findById(user._id);
    res.json({
      success: true,
      data: {
        token,
        user: fullUser,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// In-memory reset tokens: token → { email, expiresAt }
const resetTokens = new Map();

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always return success to avoid email enumeration
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      resetTokens.set(token, {
        email,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });
        await sendPasswordResetEmail(email, token);
    }

    res.json({
      success: true,
      message: "If this email exists, a reset link has been sent.",
    });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const entry = resetTokens.get(token);

    if (!entry || Date.now() > entry.expiresAt) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link." });
    }

    const user = await User.findOne({ email: entry.email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.password = password;
    await user.save();
    resetTokens.delete(token);

    res.json({ success: true, message: "Password reset successfully." });
  } catch (err) {
    next(err);
  }
};
