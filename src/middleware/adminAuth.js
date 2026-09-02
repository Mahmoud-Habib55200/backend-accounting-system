const jwt = require("jsonwebtoken");

module.exports = function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    req.adminId = payload.id;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};
