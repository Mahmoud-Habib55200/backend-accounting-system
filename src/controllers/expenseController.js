const Expense  = require("../models/Expense");
const Income   = require("../models/Income");
const User     = require("../models/User");
const { recordTxn, reverseTxn } = require("./accountController");

// GET /api/expenses
exports.list = async (req, res, next) => {
  try {
    const expenses = await Expense.find({ user: req.userId }).sort({ date: -1 });
    res.json({ success: true, data: expenses });
  } catch (err) { next(err); }
};

// POST /api/expenses
exports.create = async (req, res, next) => {
  try {
    const { amount, description, date, paymentMethod, expenseType, category, currency, notes, status, accountId } = req.body;

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

    const expense = await Expense.create({
      user: req.userId,
      amount: parseFloat(amount), description,
      date:   date ? new Date(date) : new Date(),
      paymentMethod, expenseType, category,
      currency: currency || "EGP",
      notes, status: status || "confirmed",
      account: accountId || null,
    });

    if (accountId) {
      await recordTxn(req.userId, accountId, "debit", parseFloat(amount), description, expense.date, "Expense", expense._id);
    }

    res.status(201).json({ success: true, data: expense });
  } catch (err) { next(err); }
};

// PUT /api/expenses/:id
exports.update = async (req, res, next) => {
  try {
    const old = await Expense.findOne({ _id: req.params.id, user: req.userId });
    if (!old) return res.status(404).json({ success: false, message: "Expense not found" });

    // Reverse previous account debit if it existed
    if (old.account) {
      await reverseTxn(req.userId, "Expense", old._id);
    }

    const { amount, description, date, paymentMethod, expenseType, category, currency, notes, status, accountId } = req.body;

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      {
        amount: parseFloat(amount), description,
        date:   date ? new Date(date) : old.date,
        paymentMethod, expenseType, category,
        currency: currency || old.currency,
        notes, status,
        account: accountId || null,
      },
      { new: true, runValidators: true }
    );

    if (accountId) {
      await recordTxn(req.userId, accountId, "debit", parseFloat(amount), description, expense.date, "Expense", expense._id);
    }

    res.json({ success: true, data: expense });
  } catch (err) { next(err); }
};

// DELETE /api/expenses/:id
exports.remove = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.userId });
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });

    if (expense.account) {
      await reverseTxn(req.userId, "Expense", expense._id);
    }

    await expense.deleteOne();
    res.json({ success: true, message: "Expense deleted successfully" });
  } catch (err) { next(err); }
};
