const User = require("../models/User");

// Blocks mutating requests (POST/PUT/DELETE/PATCH) when subscription is expired.
// GET requests always pass through (read-only access is allowed).
module.exports = async function subscriptionCheck(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    if (!user.subscriptionEnd) return next();

    const now = new Date();
    const end = new Date(user.subscriptionEnd);
    end.setHours(23, 59, 59, 999);

    if (now > end) {
      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_EXPIRED",
        message: "Your subscription has expired. Please renew to make changes.",
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};
