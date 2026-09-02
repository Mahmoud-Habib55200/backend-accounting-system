const crypto = require("crypto");
const User   = require("../models/User");
const { sendEmailVerificationCode } = require("../services/mailer");

// In-memory email verification codes: userId → { email, code, expiresAt }
const emailCodes = new Map();

/* ── GET /api/settings/profile ──────────────────────── */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

/* ── PUT /api/settings/profile ──────────────────────── */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "الاسم مطلوب" });
    }
    const user = await User.findByIdAndUpdate(
      req.userId,
      { name: name.trim(), phone: (phone ?? "").trim() },
      { new: true, runValidators: true }
    ).select("-password");
    res.json({ success: true, message: "تم تحديث بياناتك بنجاح", data: user });
  } catch (err) { next(err); }
};

/* ── POST /api/settings/email/request ───────────────── */
exports.requestEmailChange = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: "الإيميل مطلوب" });
    }
    const newEmail = email.toLowerCase().trim();

    // Block if same as current
    const current = await User.findById(req.userId).select("email");
    if (current?.email === newEmail) {
      return res.status(400).json({ success: false, message: "ده نفس إيميلك الحالي" });
    }

    // Block if already used by another account
    const existing = await User.findOne({ email: newEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: "الإيميل ده مستخدم بالفعل" });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    emailCodes.set(req.userId, { email: newEmail, code, expiresAt: Date.now() + 15 * 60 * 1000 });

    await sendEmailVerificationCode(newEmail, code);
    res.json({ success: true, message: "تم إرسال كود التحقق" });
  } catch (err) { next(err); }
};

/* ── POST /api/settings/email/confirm ───────────────── */
exports.confirmEmailChange = async (req, res, next) => {
  try {
    const { code } = req.body;
    const entry = emailCodes.get(req.userId);

    if (!entry || Date.now() > entry.expiresAt) {
      return res.status(400).json({ success: false, message: "الكود منتهي أو غير صالح، أعد الإرسال" });
    }
    if (String(code).trim() !== entry.code) {
      return res.status(400).json({ success: false, message: "الكود غلط" });
    }

    emailCodes.delete(req.userId);
    const user = await User.findByIdAndUpdate(
      req.userId,
      { email: entry.email },
      { new: true }
    ).select("-password");

    res.json({ success: true, message: "تم تحديث الإيميل بنجاح", data: user });
  } catch (err) { next(err); }
};

/* ── POST /api/settings/photo ───────────────────────── */
exports.uploadPhoto = async (req, res, next) => {
  try {
    const { avatar } = req.body;
    if (!avatar) return res.status(400).json({ success: false, message: "لم يتم إرسال صورة" });

    // Validate format
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(avatar)) {
      return res.status(400).json({ success: false, message: "صيغة الصورة غير مدعومة (JPG / PNG / WEBP فقط)" });
    }

    // Size check (base64 → actual bytes)
    const base64Data = avatar.split(",")[1] ?? "";
    const bytes = Math.ceil(base64Data.length * 0.75);
    if (bytes > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "حجم الصورة كبير، الحد الأقصى 5MB" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar },
      { new: true }
    ).select("-password");

    res.json({ success: true, data: { avatar: user.avatar } });
  } catch (err) { next(err); }
};

/* ── DELETE /api/settings/photo ─────────────────────── */
exports.deletePhoto = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.userId, { avatar: "" });
    res.json({ success: true, message: "تم حذف الصورة" });
  } catch (err) { next(err); }
};

/* ── PUT /api/settings/locale ───────────────────────── */
exports.saveLocale = async (req, res, next) => {
  try {
    const { locale } = req.body;
    if (!["ar", "en", "tr"].includes(locale)) {
      return res.status(400).json({ success: false, message: "Invalid locale" });
    }
    const user = await User.findByIdAndUpdate(
      req.userId,
      { locale },
      { new: true }
    ).select("-password");
    res.json({ success: true, message: "Language saved", data: user });
  } catch (err) { next(err); }
};

/* ── PUT /api/settings/password ─────────────────────── */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "كل الحقول مطلوبة" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "كلمة السر الجديدة مش متطابقة" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "كلمة السر لازم تكون 8 حروف على الأقل" });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: "كلمة السر لازم تحتوي على حرف كبير" });
    }
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: "كلمة السر لازم تحتوي على رقم" });
    }

    const user = await User.findById(req.userId).select("+password");
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: "كلمة السر الحالية غير صحيحة" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "تم تغيير كلمة السر بنجاح" });
  } catch (err) { next(err); }
};
