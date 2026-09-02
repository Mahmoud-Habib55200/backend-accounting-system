const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false, // TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendPasswordResetEmail(toEmail, resetToken) {
  const resetUrl = `${process.env.CLIENT_URL ?? "http://localhost:3000"}/reset-password?token=${resetToken}`;

  await transporter.sendMail({
    from: `"Money Tracker" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Reset your password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 28px;">
          <div style="background: #0d9488; border-radius: 8px; padding: 8px;">
            <span style="color: white; font-weight: bold; font-size: 14px;">MT</span>
          </div>
          <span style="font-weight: 600; font-size: 16px; color: #111827;">Money Tracker</span>
        </div>

        <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Reset your password</h2>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          We received a request to reset your password. Click the button below to create a new one.
          This link will expire in <strong>24 hours</strong>.
        </p>

        <a href="${resetUrl}"
          style="display: inline-block; background: #0d9488; color: white; text-decoration: none;
                 padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
          Reset Password
        </a>

        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          If you didn't request this, you can safely ignore this email.<br/>
          This link expires in 24 hours.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #d1d5db; font-size: 11px; margin: 0;">
          If the button doesn't work, copy and paste this link:<br/>
          <span style="color: #6b7280;">${resetUrl}</span>
        </p>
      </div>
    `,
  });
}

async function sendEmailVerificationCode(toEmail, code) {
  await transporter.sendMail({
    from: `"Money Tracker" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Email Verification Code",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 28px;">
          <div style="background: #0d9488; border-radius: 8px; padding: 8px;">
            <span style="color: white; font-weight: bold; font-size: 14px;">MT</span>
          </div>
          <span style="font-weight: 600; font-size: 16px; color: #111827;">Money Tracker</span>
        </div>
        <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin: 0 0 8px;">تأكيد تغيير الإيميل</h2>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          استخدم الكود التالي لتأكيد إيميلك الجديد. ينتهي الكود خلال <strong>15 دقيقة</strong>.
        </p>
        <div style="background: #fff; border: 2px solid #0d9488; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0d9488;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          لو ما طلبتش تغيير الإيميل، تجاهل الرسالة دي.
        </p>
      </div>
    `,
  });
}

async function sendWelcomeEmail(toEmail, name, tempPassword, subscriptionEnd) {
  const endStr = subscriptionEnd
    ? new Date(subscriptionEnd).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })
    : "—";
  await transporter.sendMail({
    from: `"Money Tracker" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "مرحباً بك في Money Tracker — بيانات دخولك",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
          <div style="background:#0d9488;border-radius:8px;padding:8px;">
            <span style="color:white;font-weight:bold;font-size:14px;">MT</span>
          </div>
          <span style="font-weight:600;font-size:16px;color:#111827;">Money Tracker</span>
        </div>
        <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px;">أهلاً ${name}! 🎉</h2>
        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
          تم إنشاء حسابك بنجاح. استخدم البيانات التالية لتسجيل الدخول:
        </p>
        <div style="background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 10px;font-size:13px;color:#6b7280;">الإيميل</p>
          <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">${toEmail}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#6b7280;">كلمة السر المؤقتة</p>
          <p style="margin:0;font-size:20px;font-weight:800;letter-spacing:4px;color:#0d9488;">${tempPassword}</p>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:20px;">
          <p style="margin:0;font-size:13px;color:#16a34a;">
            📅 اشتراكك ساري حتى: <strong>${endStr}</strong>
          </p>
        </div>
        <a href="${process.env.CLIENT_URL ?? "http://localhost:3000"}/login"
          style="display:inline-block;background:#0d9488;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:20px;">
          ابدأ الآن
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:0;">يُنصح بتغيير كلمة السر بعد أول تسجيل دخول.</p>
      </div>
    `,
  });
}

async function sendSubscriptionUpdateEmail(toEmail, name, planLabel, subscriptionEnd) {
  const endStr = new Date(subscriptionEnd).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  await transporter.sendMail({
    from: `"Money Tracker" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "تم تحديث اشتراكك في Money Tracker",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
          <div style="background:#0d9488;border-radius:8px;padding:8px;">
            <span style="color:white;font-weight:bold;font-size:14px;">MT</span>
          </div>
          <span style="font-weight:600;font-size:16px;color:#111827;">Money Tracker</span>
        </div>
        <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px;">تم تحديث اشتراكك ✅</h2>
        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 20px;">مرحباً ${name}، تم تحديث بيانات اشتراكك:</p>
        <div style="background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">نوع الاشتراك</p>
          <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">${planLabel}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">تاريخ الانتهاء</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#0d9488;">${endStr}</p>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin:0;">إذا لم تطلب هذا التغيير، يرجى التواصل مع الدعم.</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail, sendEmailVerificationCode, sendWelcomeEmail, sendSubscriptionUpdateEmail };
