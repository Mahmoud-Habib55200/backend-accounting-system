const crypto    = require("crypto");
const jwt       = require("jsonwebtoken");
const Admin     = require("../models/Admin");
const User      = require("../models/User");
const AdminLog  = require("../models/AdminLog");
const Income    = require("../models/Income");
const Expense   = require("../models/Expense");
const Account   = require("../models/Account");
const SavingsGoal = require("../models/SavingsGoal");
const Debt      = require("../models/Debt");
const { sendWelcomeEmail, sendSubscriptionUpdateEmail } = require("../services/mailer");

/* ── helpers ─────────────────────────────────────── */
function calcEnd(type, start, customDays) {
  const d = new Date(start);
  if (type === "trial")    d.setDate(d.getDate() + 14);
  else if (type === "3months") d.setMonth(d.getMonth() + 3);
  else if (type === "6months") d.setMonth(d.getMonth() + 6);
  else if (type === "yearly")  d.setFullYear(d.getFullYear() + 1);
  else if (type === "custom")  d.setDate(d.getDate() + (parseInt(customDays) || 30));
  return d;
}

function planLabel(type) {
  return { trial:"تجريبي", "3months":"3 أشهر", "6months":"6 أشهر", yearly:"سنة", custom:"مخصص" }[type] ?? type;
}

function userStatus(user) {
  if (user.isSuspended) return "suspended";
  if (!user.subscriptionEnd) return "active";
  const now  = Date.now();
  const end  = new Date(user.subscriptionEnd).getTime();
  if (now > end)                            return "expired";
  if (end - now < 7 * 24 * 60 * 60 * 1000) return "expiring";
  return "active";
}

async function log(adminId, userId, action, details, reason) {
  await AdminLog.create({ admin: adminId || null, user: userId, action, details, reason });
}

/* ── POST /api/admin/auth/login ──────────────────── */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).select("+password");
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "بيانات خاطئة" });
    }
    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "30m" }
    );
    res.json({ success: true, data: { token, admin: { _id: admin._id, name: admin.name, email: admin.email } } });
  } catch (err) { next(err); }
};

/* ── GET /api/admin/stats ────────────────────────── */
exports.getStats = async (req, res, next) => {
  try {
    const users = await User.find({}, "subscriptionType subscriptionEnd isSuspended createdAt");
    const now   = Date.now();
    const total      = users.length;
    const suspended  = users.filter(u => u.isSuspended).length;
    const expired    = users.filter(u => !u.isSuspended && u.subscriptionEnd && new Date(u.subscriptionEnd).getTime() < now).length;
    const expiring   = users.filter(u => !u.isSuspended && u.subscriptionEnd && new Date(u.subscriptionEnd).getTime() - now < 7*24*60*60*1000 && new Date(u.subscriptionEnd).getTime() > now).length;
    const trial      = users.filter(u => u.subscriptionType === "trial" && !u.isSuspended).length;
    const active     = total - suspended - expired;

    /* monthly new users — last 6 months */
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const y   = d.getFullYear(), m = d.getMonth();
      const cnt = users.filter(u => { const c = new Date(u.createdAt); return c.getFullYear()===y && c.getMonth()===m; }).length;
      monthly.push({ month: d.toLocaleString("ar-EG", { month: "short" }), count: cnt });
    }

    /* plan distribution */
    const planDist = ["trial","3months","6months","yearly","custom"].map(p => ({
      plan: planLabel(p),
      count: users.filter(u => u.subscriptionType === p).length,
    }));

    /* expiring this week */
    const week = now + 7*24*60*60*1000;
    const expiringUsers = await User.find({
      isSuspended: false,
      subscriptionEnd: { $gt: new Date(), $lt: new Date(week) },
    }).select("name email subscriptionType subscriptionEnd").limit(10);

    res.json({ success: true, data: { total, active, suspended, expired, expiring, trial, monthly, planDist, expiringUsers } });
  } catch (err) { next(err); }
};

/* ── GET /api/admin/users ────────────────────────── */
exports.getUsers = async (req, res, next) => {
  try {
    const { search, plan, status: statusFilter, sort = "expiring_first" } = req.query;
    let query = {};
    if (search)  query.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
    if (plan && plan !== "all") query.subscriptionType = plan;

    let users = await User.find(query).select("-password").sort({ createdAt: -1 });

    /* attach computed status */
    users = users.map(u => ({ ...u.toObject(), _status: userStatus(u) }));

    /* filter by status */
    if (statusFilter && statusFilter !== "all") {
      users = users.filter(u => u._status === statusFilter);
    }

    /* sort: expiring first, then expired, then active */
    if (sort === "expiring_first") {
      const order = { expiring: 0, expired: 1, active: 2, suspended: 3 };
      users.sort((a, b) => (order[a._status] ?? 4) - (order[b._status] ?? 4));
    }

    res.json({ success: true, data: users });
  } catch (err) { next(err); }
};

/* ── POST /api/admin/users ───────────────────────── */
exports.createUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, subscriptionType, customDays, subscriptionStart } = req.body;
    if (!firstName || !email) return res.status(400).json({ success: false, message: "الاسم الأول والإيميل مطلوبان" });
    if (!password || password.length < 6) return res.status(400).json({ success: false, message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: "الإيميل مستخدم بالفعل" });

    const start = subscriptionStart ? new Date(subscriptionStart) : new Date();
    const end   = calcEnd(subscriptionType || "trial", start, customDays);

    const user = await User.create({
      name: `${firstName.trim()} ${lastName?.trim() ?? ""}`.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone?.trim() ?? "",
      subscriptionType: subscriptionType || "trial",
      subscriptionStart: start,
      subscriptionEnd: end,
    });

    await log(req.adminId, user._id, "create_user", { subscriptionType, subscriptionEnd: end }, "إنشاء حساب جديد");

    try {
      await sendWelcomeEmail(email, user.name, password, end);
    } catch { /* email failure shouldn't break the response */ }

    res.status(201).json({ success: true, data: { ...user.toObject(), _status: userStatus(user) } });
  } catch (err) { next(err); }
};

/* ── GET /api/admin/users/:id ────────────────────── */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    res.json({ success: true, data: { ...user.toObject(), _status: userStatus(user) } });
  } catch (err) { next(err); }
};

/* ── PUT /api/admin/users/:id/subscription ───────── */
exports.updateSubscription = async (req, res, next) => {
  try {
    const { subscriptionType, customDays, subscriptionEnd: manualEnd, extensionDays, freeDays, reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    let action = "change_plan";
    const details = { reason };

    if (manualEnd) {
      user.subscriptionEnd = new Date(manualEnd);
      action = "manual_date";
      details.newEnd = manualEnd;
    } else if (extensionDays) {
      const base = user.subscriptionEnd && user.subscriptionEnd > new Date() ? user.subscriptionEnd : new Date();
      user.subscriptionEnd = new Date(base.getTime() + parseInt(extensionDays) * 86400000);
      action = "extend_subscription";
      details.days = extensionDays;
    } else if (freeDays) {
      const base = user.subscriptionEnd && user.subscriptionEnd > new Date() ? user.subscriptionEnd : new Date();
      user.subscriptionEnd = new Date(base.getTime() + parseInt(freeDays) * 86400000);
      action = "add_free_days";
      details.days = freeDays;
    } else if (subscriptionType) {
      const start = new Date();
      user.subscriptionType = subscriptionType;
      user.subscriptionStart = start;
      user.subscriptionEnd   = calcEnd(subscriptionType, start, customDays);
      details.newPlan = subscriptionType;
      details.newEnd  = user.subscriptionEnd;
    }

    await user.save();
    await log(req.adminId, user._id, action, details, reason);

    try {
      await sendSubscriptionUpdateEmail(user.email, user.name, planLabel(user.subscriptionType), user.subscriptionEnd);
    } catch { /* silent */ }

    res.json({ success: true, data: { ...user.toObject(), _status: userStatus(user) } });
  } catch (err) { next(err); }
};

/* ── POST /api/admin/users/:id/suspend ───────────── */
exports.suspendUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    user.isSuspended = true;
    await user.save();
    await log(req.adminId, user._id, "suspend", {}, reason);
    res.json({ success: true, data: { ...user.toObject(), _status: "suspended" } });
  } catch (err) { next(err); }
};

/* ── POST /api/admin/users/:id/activate ─────────── */
exports.activateUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    user.isSuspended = false;
    await user.save();
    await log(req.adminId, user._id, "activate", {}, reason);
    res.json({ success: true, data: { ...user.toObject(), _status: userStatus(user) } });
  } catch (err) { next(err); }
};

/* ── GET /api/admin/users/:id/logs ──────────────── */
exports.getUserLogs = async (req, res, next) => {
  try {
    const logs = await AdminLog.find({ user: req.params.id })
      .populate("admin", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
};

/* ── POST /api/admin/auth/seed ───────────────────── */
exports.seedAdmin = async (req, res, next) => {
  try {
    const exists = await Admin.findOne({ email: req.body.email });
    if (exists) return res.status(409).json({ success: false, message: "Admin already exists" });
    const admin = await Admin.create(req.body);
    res.status(201).json({ success: true, data: { _id: admin._id, email: admin.email } });
  } catch (err) { next(err); }
};

/* ── GET /api/admin/dashboard ────────────────────── */
exports.getDashboard = async (req, res, next) => {
  try {
    const now            = new Date();
    const thirtyDaysAgo  = new Date(now.getTime() - 30  * 86400000);
    const startOfMonth   = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMo  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMo    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const ninetyDaysAgo  = new Date(now.getTime() - 90  * 86400000);

    const PRICES      = { "3months": 1999, "6months": 2999, "yearly": 4999, trial: 0, custom: 0 };
    const PLAN_LABELS = { trial: "تجريبي", "3months": "3 أشهر", "6months": "6 أشهر", yearly: "سنة", custom: "مخصص" };

    /* ── users + feature usage queries in parallel ── */
    const [
      users,
      incomeUserIds, expenseUserIds, accountUserIds,
      cashUserIds, savingsUserIds, debtUserIds,
      incRecs, expRecs,
      recentLogs,
    ] = await Promise.all([
      User.find({}).select("-password").lean(),
      Income.distinct("user"),
      Expense.distinct("user"),
      Account.distinct("user"),
      Account.distinct("user", { type: "cash" }),
      SavingsGoal.distinct("user"),
      Debt.distinct("user"),
      Income.find({ createdAt: { $gte: ninetyDaysAgo } }).select("createdAt").lean(),
      Expense.find({ createdAt: { $gte: ninetyDaysAgo } }).select("createdAt").lean(),
      AdminLog.find().populate("admin","name").populate("user","name email").sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    /* ── helpers ── */
    const isActive  = u => !u.isSuspended && (!u.subscriptionEnd || new Date(u.subscriptionEnd) > now);
    const isExpired = u => !u.isSuspended && u.subscriptionEnd && new Date(u.subscriptionEnd) < now;

    const activeUsers = users.filter(isActive);
    const activeSet   = new Set(activeUsers.map(u => u._id.toString()));

    /* ── KPIs ── */
    const total         = users.length;
    const active        = activeUsers.length;
    const expired       = users.filter(isExpired).length;
    const suspended     = users.filter(u => u.isSuspended).length;
    const trial         = users.filter(u => u.subscriptionType === "trial").length;
    const converted     = users.filter(u => u.subscriptionType !== "trial").length;
    const conversionRate = total > 0 ? parseFloat((converted / total * 100).toFixed(1)) : 0;
    const thisMonthNew  = users.filter(u => new Date(u.createdAt) >= startOfMonth).length;
    const lastMonthNew  = users.filter(u => { const c = new Date(u.createdAt); return c >= startOfLastMo && c <= endOfLastMo; }).length;
    const totalMoM      = lastMonthNew > 0 ? parseFloat(((thisMonthNew - lastMonthNew) / lastMonthNew * 100).toFixed(1)) : null;

    /* ── Monthly growth — 12 months ── */
    const monthly = [];
    for (let i = 11; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y   = d.getFullYear(), m = d.getMonth();
      const cnt = users.filter(u => { const c = new Date(u.createdAt); return c.getFullYear() === y && c.getMonth() === m; }).length;
      monthly.push({ label: d.toLocaleString("ar-EG", { month: "short", year: "2-digit" }), count: cnt, y, m });
    }

    /* ── Weekly growth — 12 weeks ── */
    const weekly = [];
    for (let i = 11; i >= 0; i--) {
      const ws = new Date(now); ws.setDate(now.getDate() - i * 7); ws.setHours(0,0,0,0);
      const we = new Date(ws); we.setDate(ws.getDate() + 6); we.setHours(23,59,59,999);
      const cnt = users.filter(u => { const c = new Date(u.createdAt); return c >= ws && c <= we; }).length;
      weekly.push({ label: `أسبوع ${12 - i}`, count: cnt });
    }

    /* ── Plan distribution ── */
    const planDist = ["trial","3months","6months","yearly","custom"].map(p => {
      const all    = users.filter(u => u.subscriptionType === p);
      const act    = all.filter(isActive).length;
      return { type: p, plan: PLAN_LABELS[p], count: all.length, activeCount: act, revenue: act * (PRICES[p] || 0) };
    }).filter(p => p.count > 0);

    /* ── Revenue ── */
    const byPlan = ["3months","6months","yearly"].map(p => {
      const cnt = users.filter(u => u.subscriptionType === p && isActive(u)).length;
      return { plan: PLAN_LABELS[p], type: p, price: PRICES[p], count: cnt, revenue: cnt * PRICES[p] };
    });
    const totalRevenue = byPlan.reduce((s, r) => s + r.revenue, 0);

    const upcomingRenewals = users.filter(u => {
      if (u.isSuspended || !u.subscriptionEnd) return false;
      const end = new Date(u.subscriptionEnd);
      return end > now && end <= new Date(now.getTime() + 30 * 86400000);
    });
    const expectedRevenue = upcomingRenewals.reduce((s, u) => s + (PRICES[u.subscriptionType] || 0), 0);
    const upcomingList = upcomingRenewals.map(u => ({
      _id: u._id, name: u.name, email: u.email,
      subscriptionType: u.subscriptionType, subscriptionEnd: u.subscriptionEnd,
      daysLeft: Math.ceil((new Date(u.subscriptionEnd) - now) / 86400000),
      expectedRevenue: PRICES[u.subscriptionType] || 0,
    })).sort((a, b) => a.daysLeft - b.daysLeft);

    /* ── Conversion funnel ── */
    const expiredTrial = users.filter(u => u.subscriptionType === "trial" && u.subscriptionEnd && new Date(u.subscriptionEnd) < now).length;
    const funnel = { enteredTrial: total, completedTrial: expiredTrial, converted, notConverted: Math.max(0, expiredTrial - converted) };

    /* ── Unconverted expired trial users ── */
    const unconvertedList = users
      .filter(u => u.subscriptionType === "trial" && u.subscriptionEnd && new Date(u.subscriptionEnd) < now)
      .map(u => ({ _id: u._id, name: u.name, email: u.email, phone: u.phone, subscriptionEnd: u.subscriptionEnd }))
      .sort((a, b) => new Date(b.subscriptionEnd) - new Date(a.subscriptionEnd))
      .slice(0, 20);

    /* ── At-risk (expiring ≤7 days) ── */
    const atRisk = users
      .filter(u => {
        if (u.isSuspended || !u.subscriptionEnd) return false;
        const diff = new Date(u.subscriptionEnd) - now;
        return diff > 0 && diff <= 7 * 86400000;
      })
      .map(u => ({
        _id: u._id, name: u.name, email: u.email, phone: u.phone,
        subscriptionType: u.subscriptionType, subscriptionEnd: u.subscriptionEnd,
        daysLeft: Math.ceil((new Date(u.subscriptionEnd) - now) / 86400000),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    /* ── Churned users ── */
    const mapChurned = u => ({
      _id: u._id, name: u.name, email: u.email, phone: u.phone,
      subscriptionType: u.subscriptionType, subscriptionEnd: u.subscriptionEnd,
      daysSince: Math.floor((now - new Date(u.subscriptionEnd)) / 86400000),
    });
    const churnedRecent = users.filter(u => !u.isSuspended && u.subscriptionEnd && new Date(u.subscriptionEnd) < now && new Date(u.subscriptionEnd) >= thirtyDaysAgo).map(mapChurned).sort((a,b) => a.daysSince - b.daysSince);
    const churnedOld    = users.filter(u => !u.isSuspended && u.subscriptionEnd && new Date(u.subscriptionEnd) < thirtyDaysAgo).map(mapChurned).sort((a,b) => a.daysSince - b.daysSince);

    /* ── Feature usage ── */
    const countActive = ids => ids.filter(id => activeSet.has(id.toString())).length;
    const act1 = active || 1;
    const featureUsage = [
      { name: "الداشبورد",         count: active,                       pct: 100 },
      { name: "تسجيل المصاريف",    count: countActive(expenseUserIds),  pct: Math.round(countActive(expenseUserIds)  / act1 * 100) },
      { name: "الحسابات والمحافظ", count: countActive(accountUserIds),  pct: Math.round(countActive(accountUserIds)  / act1 * 100) },
      { name: "تسجيل الإيرادات",   count: countActive(incomeUserIds),   pct: Math.round(countActive(incomeUserIds)   / act1 * 100) },
      { name: "تتبع الكاش",        count: countActive(cashUserIds),     pct: Math.round(countActive(cashUserIds)     / act1 * 100) },
      { name: "أهداف الادخار",     count: countActive(savingsUserIds),  pct: Math.round(countActive(savingsUserIds)  / act1 * 100) },
      { name: "إدارة الديون",      count: countActive(debtUserIds),     pct: Math.round(countActive(debtUserIds)     / act1 * 100) },
    ].sort((a, b) => b.pct - a.pct);

    /* ── Heatmap (record creation timestamps as activity proxy) ── */
    const heatGrid = {};
    [...incRecs, ...expRecs].forEach(r => {
      const d = new Date(r.createdAt);
      const k = `${d.getDay()}-${d.getHours()}`;
      heatGrid[k] = (heatGrid[k] || 0) + 1;
    });
    const heatmap = [];
    for (let day = 0; day < 7; day++)
      for (let hour = 0; hour < 24; hour++)
        heatmap.push({ day, hour, count: heatGrid[`${day}-${hour}`] || 0 });

    const maxHeat = Math.max(...heatmap.map(h => h.count), 1);

    res.json({
      success: true,
      data: {
        kpis: { total, active, expired, suspended, trial, converted, conversionRate, thisMonthNew, lastMonthNew, totalMoM, churnCount: churnedRecent.length + churnedOld.length },
        monthly, weekly, planDist,
        revenue: { byPlan, total: totalRevenue, expected: expectedRevenue, upcoming: upcomingList },
        funnel, unconvertedList,
        atRisk,
        churned: { recent: churnedRecent, old: churnedOld },
        featureUsage, heatmap, maxHeat,
        recentLogs: recentLogs.map(l => ({
          _id: l._id, action: l.action, details: l.details, createdAt: l.createdAt,
          adminName: l.admin?.name || "النظام",
          userName: l.user?.name || "—", userEmail: l.user?.email || "",
        })),
      },
    });
  } catch (err) { next(err); }
};
