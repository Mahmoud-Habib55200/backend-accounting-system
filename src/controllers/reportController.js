const mongoose        = require("mongoose");
const Income          = require("../models/Income");
const Expense         = require("../models/Expense");
const ExpenseCategory = require("../models/ExpenseCategory");
const Account         = require("../models/Account");
const AccountTransaction = require("../models/AccountTransaction");
const Debt            = require("../models/Debt");
const DebtPayment     = require("../models/DebtPayment");
const Transaction     = require("../models/Transaction");

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ── helpers ─────────────────────────────────────── */
function oid(id) { return new mongoose.Types.ObjectId(id); }

function buildRange(months, from, to) {
  if (from && to) {
    const s = new Date(from);
    const e = new Date(to); e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  const now = new Date();
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const start = new Date(now.getFullYear(), now.getMonth() - (parseInt(months) - 1), 1);
  return { start, end };
}

function monthsInRange(start, end) {
  const out = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    out.push({
      year: d.getFullYear(), month: d.getMonth(),
      monthNum: d.getMonth() + 1,
      label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
    });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/* ═══════════════════════════════════════════════════
   LEGACY (keep for backward compat)
═══════════════════════════════════════════════════ */
exports.summary = async (req, res, next) => {
  try {
    const userId = oid(req.userId);
    const [incomeAgg, expenseAgg, debtAgg] = await Promise.all([
      Income.aggregate([{ $match: { user: userId } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Expense.aggregate([{ $match: { user: userId } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Debt.aggregate([
        { $match: { userId: oid(req.userId), status: { $in: ["active","overdue"] } } },
        { $group: { _id: null, total: { $sum: { $subtract: ["$totalAmount","$paidAmount"] } } } },
      ]),
    ]);
    res.json({ success: true, data: {
      totalIncome:   incomeAgg[0]?.total   ?? 0,
      totalExpenses: expenseAgg[0]?.total  ?? 0,
      totalDebt:     debtAgg[0]?.total     ?? 0,
      currentBalance: (incomeAgg[0]?.total ?? 0) - (expenseAgg[0]?.total ?? 0),
    }});
  } catch (err) { next(err); }
};

exports.monthly = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const userId = oid(req.userId);
    const data = await Transaction.aggregate([
      { $match: { userId: oid(req.userId), status: "completed",
          date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) } } },
      { $group: { _id: { month: { $month: "$date" }, type: "$type" }, total: { $sum: "$amount" } } },
      { $sort: { "_id.month": 1 } },
    ]);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════
   US-701 — Income vs Expenses
═══════════════════════════════════════════════════ */
exports.incomeExpenses = async (req, res, next) => {
  try {
    const userId = oid(req.userId);
    const { months = 6, from, to } = req.query;
    const { start, end } = buildRange(months, from, to);
    const slots = monthsInRange(start, end);

    const [incAgg, expAgg] = await Promise.all([
      Income.aggregate([
        { $match: { user: userId, receivedDate: { $gte: start, $lte: end } } },
        { $group: { _id: { y: { $year: "$receivedDate" }, m: { $month: "$receivedDate" } }, total: { $sum: "$amount" } } },
      ]),
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: start, $lte: end } } },
        { $group: { _id: { y: { $year: "$date" }, m: { $month: "$date" } }, total: { $sum: "$amount" } } },
      ]),
    ]);

    const incMap = Object.fromEntries(incAgg.map((r) => [`${r._id.y}-${r._id.m}`, r.total]));
    const expMap = Object.fromEntries(expAgg.map((r) => [`${r._id.y}-${r._id.m}`, r.total]));

    const monthly = slots.map(({ label, year, monthNum }) => {
      const k = `${year}-${monthNum}`;
      const income   = incMap[k] ?? 0;
      const expenses = expMap[k] ?? 0;
      return { label, income, expenses, net: income - expenses };
    });

    const avgIncome   = monthly.reduce((s, r) => s + r.income,   0) / (monthly.length || 1);
    const avgExpenses = monthly.reduce((s, r) => s + r.expenses, 0) / (monthly.length || 1);
    const totalIncome   = monthly.reduce((s, r) => s + r.income,   0);
    const totalExpenses = monthly.reduce((s, r) => s + r.expenses, 0);

    res.json({ success: true, data: { monthly, avgIncome, avgExpenses, totalIncome, totalExpenses } });
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════
   US-702 — Expense Categories
═══════════════════════════════════════════════════ */
exports.categories = async (req, res, next) => {
  try {
    const userId = oid(req.userId);
    const { months = 1, from, to, expenseType = "all" } = req.query;
    const { start, end } = buildRange(months, from, to);

    const matchFilter = { user: userId, date: { $gte: start, $lte: end } };
    if (expenseType && expenseType !== "all") matchFilter.expenseType = expenseType;

    const [catAgg, allCats, topExpenses] = await Promise.all([
      Expense.aggregate([
        { $match: matchFilter },
        { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      ExpenseCategory.find({ user: userId }).lean(),
      Expense.find(matchFilter).sort({ amount: -1 }).limit(5).lean(),
    ]);

    const catMap = Object.fromEntries(allCats.map((c) => [String(c._id), c]));
    const totalExpenses = catAgg.reduce((s, r) => s + r.total, 0);

    // For each top category, get its top expenses
    const COLORS = ["#0d9488","#6366f1","#f59e0b","#ec4899","#0891b2","#84cc16","#f97316","#8b5cf6"];
    const categories = await Promise.all(catAgg.map(async (row, i) => {
      const cat = catMap[row._id];
      const expenses = await Expense.find({ ...matchFilter, category: row._id })
        .sort({ amount: -1 }).limit(8).lean();
      return {
        categoryId: row._id,
        name:  cat?.name  ?? row._id ?? "Other",
        color: cat?.color && cat.color !== "#6b7280" ? cat.color : COLORS[i % COLORS.length],
        total: row.total, count: row.count,
        pct:   totalExpenses > 0 ? (row.total / totalExpenses) * 100 : 0,
        expenses: expenses.map((e) => ({
          _id: String(e._id), description: e.description, amount: e.amount,
          date: e.date, currency: e.currency,
        })),
      };
    }));

    res.json({ success: true, data: { categories, totalExpenses } });
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════
   US-703 — Cash Flow
═══════════════════════════════════════════════════ */
exports.cashFlow = async (req, res, next) => {
  try {
    const userId = oid(req.userId);
    const { months = 1, from, to } = req.query;
    const { start, end } = buildRange(months, from, to);

    const [incomes, expenses] = await Promise.all([
      Income.find({ user: userId, receivedDate: { $gte: start, $lte: end } }).sort({ receivedDate: 1 }).lean(),
      Expense.find({ user: userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }).lean(),
    ]);

    const items = [
      ...incomes.map((x) => ({ _id: String(x._id), type: "income",   name: x.name, category: x.category, amount: x.amount, currency: x.currency, date: x.receivedDate })),
      ...expenses.map((x) => ({ _id: String(x._id), type: "expense", name: x.description, category: x.category, amount: x.amount, currency: x.currency, date: x.date })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    const timeline = items.map((item) => {
      running += item.type === "income" ? item.amount : -item.amount;
      return { ...item, runningBalance: running };
    });

    const totalIn  = incomes.reduce((s, x) => s + x.amount, 0);
    const totalOut = expenses.reduce((s, x) => s + x.amount, 0);

    // Daily aggregation for chart
    const dayMap = {};
    for (const item of items) {
      const key = new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      if (!dayMap[key]) dayMap[key] = { income: 0, expenses: 0 };
      if (item.type === "income") dayMap[key].income   += item.amount;
      else                        dayMap[key].expenses += item.amount;
    }
    const dailyChart = Object.entries(dayMap).map(([label, v]) => ({ label, ...v }));

    res.json({ success: true, data: {
      timeline, totalIn, totalOut, netFlow: totalIn - totalOut, dailyChart,
    }});
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════
   US-704 — Savings Rate
═══════════════════════════════════════════════════ */
exports.savings = async (req, res, next) => {
  try {
    const userId = oid(req.userId);
    const { months = 6, from, to } = req.query;
    const { start, end } = buildRange(months, from, to);
    const slots = monthsInRange(start, end);

    const [incAgg, expAgg] = await Promise.all([
      Income.aggregate([
        { $match: { user: userId, receivedDate: { $gte: start, $lte: end } } },
        { $group: { _id: { y: { $year: "$receivedDate" }, m: { $month: "$receivedDate" } }, total: { $sum: "$amount" } } },
      ]),
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: start, $lte: end } } },
        { $group: { _id: { y: { $year: "$date" }, m: { $month: "$date" } }, total: { $sum: "$amount" } } },
      ]),
    ]);

    const incMap = Object.fromEntries(incAgg.map((r) => [`${r._id.y}-${r._id.m}`, r.total]));
    const expMap = Object.fromEntries(expAgg.map((r) => [`${r._id.y}-${r._id.m}`, r.total]));

    const monthly = slots.map(({ label, year, monthNum }) => {
      const k = `${year}-${monthNum}`;
      const income   = incMap[k] ?? 0;
      const expenses = expMap[k] ?? 0;
      const savings  = income - expenses;
      const rate     = income > 0 ? (savings / income) * 100 : 0;
      return { label, income, expenses, savings, rate };
    });

    const validMonths = monthly.filter((m) => m.income > 0);
    const avgRate  = validMonths.length ? validMonths.reduce((s, m) => s + m.rate, 0) / validMonths.length : 0;
    const avgSavings = validMonths.length ? validMonths.reduce((s, m) => s + m.savings, 0) / validMonths.length : 0;

    res.json({ success: true, data: { monthly, avgRate, avgSavings, targetRate: 20 } });
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════
   US-705 — Net Worth History
═══════════════════════════════════════════════════ */
exports.netWorth = async (req, res, next) => {
  try {
    const userId = oid(req.userId);
    const { months = 6 } = req.query;

    const now = new Date();
    const slots = [];
    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      slots.push({
        label: `${MONTHS[end.getMonth() === 11 && i > 0 ? 11 : end.getMonth()]} ${String(end.getFullYear()).slice(2)}`,
        end,
      });
    }
    // Recalculate labels correctly
    const slotsFinal = [];
    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      slotsFinal.push({ label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, end });
    }

    const [debts, allPayments] = await Promise.all([
      Debt.find({ userId: oid(req.userId) }).lean(),
      DebtPayment.find({ userId: oid(req.userId) }).lean(),
    ]);

    const monthly = await Promise.all(slotsFinal.map(async ({ label, end: monthEnd }) => {
      // Account balance at monthEnd (last transaction per account up to that date)
      const accAgg = await AccountTransaction.aggregate([
        { $match: { user: userId, date: { $lte: monthEnd } } },
        { $sort: { date: -1 } },
        { $group: { _id: "$account", lastBalance: { $first: "$balanceAfter" } } },
        { $group: { _id: null, total: { $sum: "$lastBalance" } } },
      ]);
      const totalAccounts = accAgg[0]?.total ?? 0;

      // Debt remaining at monthEnd
      let totalDebt = 0;
      for (const d of debts) {
        if (d.startDate && new Date(d.startDate) > monthEnd) continue;
        const paymentsAfter = allPayments
          .filter((p) => String(p.debt) === String(d._id) && new Date(p.date) > monthEnd)
          .reduce((s, p) => s + p.amount, 0);
        totalDebt += Math.max(0, d.totalAmount - d.paidAmount + paymentsAfter);
      }

      return { label, totalAccounts, totalDebt, netWorth: totalAccounts - totalDebt };
    }));

    const first = monthly[0]?.netWorth ?? 0;
    const last  = monthly[monthly.length - 1]?.netWorth ?? 0;

    res.json({ success: true, data: {
      monthly,
      currentNetWorth: last,
      change: last - first,
      changePct: first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null,
    }});
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════
   US-706 — Debt Progress
═══════════════════════════════════════════════════ */
exports.debtProgress = async (req, res, next) => {
  try {
    const userId = oid(req.userId);
    const debtUserId = oid(req.userId);

    const [debts, allPayments] = await Promise.all([
      Debt.find({ userId: debtUserId }).sort({ createdAt: -1 }).lean(),
      DebtPayment.find({ userId: debtUserId }).sort({ date: 1 }).lean(),
    ]);

    const MONTHS_LABELS = MONTHS;
    const debtsWithProgress = debts.map((d) => {
      const myPayments = allPayments.filter((p) => String(p.debt) === String(d._id));
      const remainingAmount = Math.max(0, d.totalAmount - d.paidAmount);
      const progressPct = d.totalAmount > 0 ? Math.min(100, (d.paidAmount / d.totalAmount) * 100) : 0;

      // Monthly payment groups
      const monthMap = {};
      for (const p of myPayments) {
        const pd = new Date(p.date);
        const k = `${MONTHS_LABELS[pd.getMonth()]} ${String(pd.getFullYear()).slice(2)}`;
        monthMap[k] = (monthMap[k] || 0) + p.amount;
      }
      const monthlyPayments = Object.entries(monthMap).map(([label, amount]) => ({ label, amount }));

      // Avg monthly payment (last 3 months)
      const recentPayments = myPayments.slice(-3);
      const avgMonthly = recentPayments.length
        ? recentPayments.reduce((s, p) => s + p.amount, 0) / recentPayments.length
        : 0;
      const monthsLeft = avgMonthly > 0 ? Math.ceil(remainingAmount / avgMonthly) : null;
      const estPayoff  = monthsLeft !== null
        ? new Date(Date.now() + monthsLeft * 30.44 * 86_400_000).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
        : null;

      return {
        _id: String(d._id), creditor: d.creditor, category: d.category,
        totalAmount: d.totalAmount, paidAmount: d.paidAmount, remainingAmount,
        progressPct, currency: d.currency, status: d.status,
        startDate: d.startDate, dueDate: d.dueDate, interestRate: d.interestRate,
        monthlyPayments, avgMonthly, estPayoff,
        paymentsCount: myPayments.length,
      };
    });

    const allPaid = debts.length > 0 && debts.every((d) => d.status === "paid");
    const totalPaid = debts.reduce((s, d) => s + d.paidAmount, 0);
    const totalRemaining = debts.reduce((s, d) => s + Math.max(0, d.totalAmount - d.paidAmount), 0);

    res.json({ success: true, data: { debts: debtsWithProgress, allPaid, totalPaid, totalRemaining } });
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════
   US-707 — Spending Habits
═══════════════════════════════════════════════════ */
exports.spendingHabits = async (req, res, next) => {
  try {
    const userId = oid(req.userId);
    const { months = 1, from, to } = req.query;
    const { start, end } = buildRange(months, from, to);

    // Previous period for comparison
    const periodLen = end.getTime() - start.getTime();
    const prevEnd   = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodLen);

    const [expenses, prevExpenses, allCats, topExpenses, byDow] = await Promise.all([
      Expense.find({ user: userId, date: { $gte: start, $lte: end } }).lean(),
      Expense.find({ user: userId, date: { $gte: prevStart, $lte: prevEnd } }).lean(),
      ExpenseCategory.find({ user: userId }).lean(),

      // Top individual expenses
      Expense.find({ user: userId, date: { $gte: start, $lte: end } })
        .sort({ amount: -1 }).limit(5).lean(),

      // By day of week (1=Sun … 7=Sat)
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: start, $lte: end } } },
        { $group: { _id: { $dayOfWeek: "$date" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { "_id": 1 } },
      ]),
    ]);

    const catMap = Object.fromEntries(allCats.map((c) => [String(c._id), c]));
    const COLORS = ["#0d9488","#6366f1","#f59e0b","#ec4899","#0891b2","#84cc16"];

    // Top categories current period
    const catTotals = {};
    for (const e of expenses) catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    const topCategories = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, total], i) => ({
        id, name: catMap[id]?.name ?? id ?? "Other",
        color: catMap[id]?.color && catMap[id].color !== "#6b7280" ? catMap[id].color : COLORS[i % COLORS.length],
        total,
      }));

    // Prev category totals for spike detection
    const prevCatTotals = {};
    for (const e of prevExpenses) prevCatTotals[e.category] = (prevCatTotals[e.category] || 0) + e.amount;

    // Alerts: category spike > 30%
    const alerts = topCategories
      .filter(({ id, total }) => {
        const prev = prevCatTotals[id] ?? 0;
        return prev > 0 && ((total - prev) / prev) * 100 >= 30;
      })
      .map(({ id, name, total }) => {
        const prev = prevCatTotals[id];
        return { category: name, pctChange: Math.round(((total - prev) / prev) * 100) };
      });

    // Day of week labels (1=Sun … 7=Sat)
    const DOW_LABELS = ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const byDayOfWeek = byDow.map((r) => ({
      day: DOW_LABELS[r._id], total: r.total, count: r.count,
      isWeekend: r._id === 1 || r._id === 7,
    }));

    const weekdayTotal  = byDow.filter((r) => r._id > 1 && r._id < 7).reduce((s, r) => s + r.total, 0);
    const weekendTotal  = byDow.filter((r) => r._id === 1 || r._id === 7).reduce((s, r) => s + r.total, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({ success: true, data: {
      topCategories,
      topExpenses: topExpenses.map((e) => ({
        _id: String(e._id), description: e.description, amount: e.amount,
        date: e.date, currency: e.currency,
        categoryName: catMap[e.category]?.name ?? e.category,
      })),
      byDayOfWeek, weekdayTotal, weekendTotal, totalExpenses, alerts,
    }});
  } catch (err) { next(err); }
};
