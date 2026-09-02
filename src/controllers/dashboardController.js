const mongoose        = require("mongoose");
const Income          = require("../models/Income");
const Expense         = require("../models/Expense");
const ExpenseCategory = require("../models/ExpenseCategory");
const Account         = require("../models/Account");
const Debt            = require("../models/Debt");

/* ── helpers ─────────────────────────────────────── */
function periodBounds(period, from, to) {
  const now = new Date();
  let start, end;

  if (period === "last_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (period === "3months") {
    start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === "custom" && from && to) {
    start = new Date(from);
    end   = new Date(to);
    end.setHours(23, 59, 59, 999);
  } else {
    // default: this month
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  return { start, end };
}

/* previous period of the same length */
function prevPeriod(start, end) {
  const len = end.getTime() - start.getTime();
  const prevEnd   = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - len);
  return { prevStart, prevEnd };
}

/* GET /api/dashboard */
exports.getDashboard = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const { period = "month", from, to } = req.query;

    const { start, end } = periodBounds(period, from, to);
    const { prevStart, prevEnd } = prevPeriod(start, end);

    /* ── parallel queries ─────────────────────────── */
    const [
      incomeAgg, prevIncomeAgg,
      expenseAgg, prevExpenseAgg,
      accounts,
      debts,
      expCatAgg,
      categories,
      recentIncome,
      recentExpenses,
      chartIncome,
      chartExpenses,
    ] = await Promise.all([

      /* current period income */
      Income.aggregate([
        { $match: { user: userId, receivedDate: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),

      /* previous period income */
      Income.aggregate([
        { $match: { user: userId, receivedDate: { $gte: prevStart, $lte: prevEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      /* current period expenses */
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),

      /* previous period expenses */
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: prevStart, $lte: prevEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      /* accounts */
      Account.find({ user: userId, isActive: true }).lean(),

      /* debts (userId stored as ObjectId, userId var is already ObjectId) */
      Debt.find({ userId, status: { $in: ["active", "overdue"] } })
        .sort({ dueDate: 1 })
        .lean(),

      /* expense categories breakdown (current period, top 6) */
      Expense.aggregate([
        { $match: { user: userId, date: { $gte: start, $lte: end } } },
        { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 6 },
      ]),

      /* category name lookup — find() auto-casts ObjectId */
      ExpenseCategory.find({ user: userId }).lean(),

      /* recent income */
      Income.find({ user: userId })
        .sort({ receivedDate: -1 })
        .limit(10)
        .lean(),

      /* recent expenses */
      Expense.find({ user: userId })
        .sort({ date: -1 })
        .limit(10)
        .lean(),

      /* 6-month chart — income */
      Income.aggregate([
        {
          $match: {
            user: userId,
            receivedDate: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
              $lte: new Date(),
            },
          },
        },
        {
          $group: {
            _id: { year: { $year: "$receivedDate" }, month: { $month: "$receivedDate" } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      /* 6-month chart — expenses */
      Expense.aggregate([
        {
          $match: {
            user: userId,
            date: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
              $lte: new Date(),
            },
          },
        },
        {
          $group: {
            _id: { year: { $year: "$date" }, month: { $month: "$date" } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    /* ── assemble totals ─────────────────────────── */
    const totalIncome   = incomeAgg[0]?.total      ?? 0;
    const totalExpenses = expenseAgg[0]?.total     ?? 0;
    const prevIncome    = prevIncomeAgg[0]?.total   ?? null;
    const prevExpenses  = prevExpenseAgg[0]?.total  ?? null;
    const netBalance    = totalIncome - totalExpenses;

    /* ── accounts ────────────────────────────────── */
    const totalAccountBalance = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);

    /* ── debts ───────────────────────────────────── */
    const totalDebtRemaining = debts.reduce((s, d) => s + Math.max(0, d.totalAmount - d.paidAmount), 0);
    const overdueDebts       = debts.filter((d) => d.status === "overdue");
    const nearestDue         = debts.find((d) => d.dueDate);

    /* ── expense categories ──────────────────────── */
    const catMap = Object.fromEntries(categories.map((c) => [String(c._id), c]));
    const expenseCategories = expCatAgg.map((row) => {
      const cat = catMap[row._id];
      return {
        categoryId: row._id,
        name:  cat?.name  ?? row._id ?? "Other",
        color: cat?.color ?? "#6b7280",
        total: row.total,
        count: row.count,
      };
    });

    /* ── 6-month chart ───────────────────────────── */
    const now = new Date();
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear(), m = d.getMonth() + 1;
      const inc = chartIncome.find((r) => r._id.year === y && r._id.month === m)?.total ?? 0;
      const exp = chartExpenses.find((r) => r._id.year === y && r._id.month === m)?.total ?? 0;
      chartData.push({ month: d.getMonth(), year: y, income: inc, expenses: exp });
    }

    /* ── recent activity ─────────────────────────── */
    const activity = [
      ...recentIncome.map((x) => ({
        _id: String(x._id), type: "income",
        name: x.name, category: x.category,
        amount: x.amount, currency: x.currency,
        date: x.receivedDate,
      })),
      ...recentExpenses.map((x) => ({
        _id: String(x._id), type: "expense",
        name: x.description, category: x.category,
        amount: x.amount, currency: x.currency,
        date: x.date,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    res.json({
      success: true,
      data: {
        period: { start, end },
        income:   { total: totalIncome,   count: incomeAgg[0]?.count ?? 0 },
        expenses: { total: totalExpenses, count: expenseAgg[0]?.count ?? 0 },
        netBalance,
        prev: {
          income:   prevIncome   !== null ? { total: prevIncome }   : null,
          expenses: prevExpenses !== null ? { total: prevExpenses } : null,
          hasPrev:  prevIncome !== null || prevExpenses !== null,
        },
        accounts: accounts.map((a) => ({
          _id: String(a._id), name: a.name, type: a.type,
          balance: a.balance, currency: a.currency, color: a.color,
        })),
        totalAccountBalance,
        debts: {
          totalRemaining: totalDebtRemaining,
          activeCount:    debts.length,
          overdueCount:   overdueDebts.length,
          nearestDue:     nearestDue
            ? {
                creditor:        nearestDue.creditor,
                dueDate:         nearestDue.dueDate,
                remainingAmount: Math.max(0, nearestDue.totalAmount - nearestDue.paidAmount),
                currency:        nearestDue.currency,
                status:          nearestDue.status,
              }
            : null,
        },
        expenseCategories,
        chartData,
        recentActivity: activity,
      },
    });
  } catch (err) { next(err); }
};
