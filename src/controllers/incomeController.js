const Income   = require("../models/Income");
const Expense  = require("../models/Expense");
const User     = require("../models/User");
const { recordTxn, reverseTxn } = require("./accountController");

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function contributionForMonth(inc, year, month) {
  const rd = new Date(inc.receivedDate);
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59, 999);

  if (inc.recurrence === "once") {
    return rd >= monthStart && rd <= monthEnd ? inc.amount : 0;
  }
  if (!inc.isActive || rd > monthEnd) return 0;
  if (inc.recurrence === "monthly") return inc.amount;
  if (inc.recurrence === "yearly")  return rd.getMonth() === month ? inc.amount : 0;
  if (inc.recurrence === "weekly") {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let cur = new Date(rd.getTime());
    while (cur < monthStart) cur = new Date(cur.getTime() + weekMs);
    let count = 0;
    while (cur <= monthEnd) { count++; cur = new Date(cur.getTime() + weekMs); }
    return inc.amount * count;
  }
  return 0;
}

// GET /api/income
exports.list = async (req, res, next) => {
  try {
    const incomes = await Income.find({ user: req.userId }).sort({ receivedDate: -1 });
    res.json({ success: true, data: incomes });
  } catch (err) { next(err); }
};

// POST /api/income
exports.create = async (req, res, next) => {
  try {
    const { name, category, amount, currency, receivedDate, recurrence, status, notes, accountId } = req.body;

    const user = await User.findById(req.userId).lean();
    if (user?.subscriptionType === "trial") {
      const [incCount, expCount] = await Promise.all([
        Income.countDocuments({ user: req.userId }),
        Expense.countDocuments({ user: req.userId }),
      ]);
      if (incCount + expCount >= 20) {
        return res.status(403).json({ success: false, code: "TRIAL_LIMIT_20_ENTRIES", message: "Trial limit reached: maximum 20 entries allowed." });
      }
    }

    const income = await Income.create({
      user: req.userId,
      name, category,
      amount: parseFloat(amount),
      currency: currency || "EGP",
      receivedDate, recurrence: recurrence || "once",
      status: status || "cleared", notes,
      account: accountId || null,
    });

    if (accountId) {
      await recordTxn(req.userId, accountId, "credit", parseFloat(amount), name, new Date(receivedDate), "Income", income._id);
    }

    res.status(201).json({ success: true, data: income });
  } catch (err) { next(err); }
};

// PUT /api/income/:id
exports.update = async (req, res, next) => {
  try {
    const old = await Income.findOne({ _id: req.params.id, user: req.userId });
    if (!old) return res.status(404).json({ success: false, message: "Income not found" });

    if (old.account) {
      await reverseTxn(req.userId, "Income", old._id);
    }

    const { name, category, amount, currency, receivedDate, recurrence, status, notes, accountId } = req.body;

    const income = await Income.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      {
        name, category,
        amount: parseFloat(amount),
        currency: currency || old.currency,
        receivedDate, recurrence, status, notes,
        account: accountId || null,
      },
      { new: true, runValidators: true }
    );

    if (accountId) {
      await recordTxn(req.userId, accountId, "credit", parseFloat(amount), name, new Date(receivedDate), "Income", income._id);
    }

    res.json({ success: true, data: income });
  } catch (err) { next(err); }
};

// DELETE /api/income/:id
exports.remove = async (req, res, next) => {
  try {
    const income = await Income.findOne({ _id: req.params.id, user: req.userId });
    if (!income) return res.status(404).json({ success: false, message: "Income not found" });

    if (income.account) {
      await reverseTxn(req.userId, "Income", income._id);
    }

    await income.deleteOne();
    res.json({ success: true, message: "Income deleted successfully" });
  } catch (err) { next(err); }
};

// GET /api/income/summary?months=6
exports.summary = async (req, res, next) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 6, 24);
    const allIncomes = await Income.find({ user: req.userId });
    const now = new Date();
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year  = d.getFullYear();
      const month = d.getMonth();
      const total = allIncomes.reduce((sum, inc) => sum + contributionForMonth(inc, year, month), 0);
      result.push({ month: MONTH_LABELS[month], year, total });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
