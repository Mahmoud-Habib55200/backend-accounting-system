const SavingsGoal        = require("../models/SavingsGoal");
const SavingsTransaction = require("../models/SavingsTransaction");
const Account            = require("../models/Account");
const AccountTransaction = require("../models/AccountTransaction");

/* ── helper: credit an account and record the transaction ── */
async function creditAccount(userId, accountId, amount, description, date) {
  const acc = await Account.findOne({ _id: accountId, user: userId });
  if (!acc) throw { status: 404, message: "Account not found." };
  const balBefore = acc.balance;
  acc.balance += amount;
  await acc.save();
  await AccountTransaction.create({
    user: userId, account: acc._id,
    type: "credit", amount,
    description,
    balanceBefore: balBefore, balanceAfter: acc.balance,
    date: date || new Date(),
  });
  return acc;
}

/* ── helper: debit an account and record the transaction ── */
async function debitAccount(userId, accountId, amount, description, date) {
  const acc = await Account.findOne({ _id: accountId, user: userId });
  if (!acc) throw { status: 404, message: "Account not found." };
  if (acc.balance < amount) throw { status: 400, message: "Insufficient account balance." };
  const balBefore = acc.balance;
  acc.balance -= amount;
  await acc.save();
  await AccountTransaction.create({
    user: userId, account: acc._id,
    type: "debit", amount,
    description,
    balanceBefore: balBefore, balanceAfter: acc.balance,
    date: date || new Date(),
  });
  return acc;
}

/* ── GET /api/savings ─────────────────────────────────── */
exports.getAll = async (req, res, next) => {
  try {
    const goals = await SavingsGoal.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: goals });
  } catch (err) { next(err); }
};

/* ── GET /api/savings/:id ─────────────────────────────── */
exports.getOne = async (req, res, next) => {
  try {
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });
    res.json({ success: true, data: goal });
  } catch (err) { next(err); }
};

/* ── POST /api/savings ────────────────────────────────── */
exports.create = async (req, res, next) => {
  try {
    const { name, emoji, targetAmount, currency, targetDate, description } = req.body;
    if (!name?.trim() || !targetAmount) {
      return res.status(400).json({ success: false, message: "Name and target amount are required." });
    }
    const exists = await SavingsGoal.findOne({ user: req.userId, name: name.trim() });
    if (exists) return res.status(409).json({ success: false, message: "A goal with this name already exists." });

    const goal = await SavingsGoal.create({
      user: req.userId,
      name: name.trim(),
      emoji: emoji?.trim() || "🎯",
      targetAmount: parseFloat(targetAmount),
      currency: currency || "EGP",
      targetDate: targetDate ? new Date(targetDate) : undefined,
      description: description?.trim(),
    });
    res.status(201).json({ success: true, data: goal });
  } catch (err) { next(err); }
};

/* ── PUT /api/savings/:id ─────────────────────────────── */
exports.update = async (req, res, next) => {
  try {
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });
    if (goal.status !== "active") {
      return res.status(400).json({ success: false, message: "Cannot edit a completed or archived goal." });
    }
    const { name, emoji, targetAmount, currency, targetDate, description } = req.body;

    if (name && name.trim() !== goal.name) {
      const dup = await SavingsGoal.findOne({ user: req.userId, name: name.trim(), _id: { $ne: goal._id } });
      if (dup) return res.status(409).json({ success: false, message: "A goal with this name already exists." });
      goal.name = name.trim();
    }
    if (emoji !== undefined) goal.emoji = emoji?.trim() || "🎯";
    if (targetAmount !== undefined) {
      const amt = parseFloat(targetAmount);
      if (amt < goal.currentAmount) {
        return res.status(400).json({ success: false, message: "Target amount cannot be less than the amount already saved." });
      }
      goal.targetAmount = amt;
    }
    if (currency)      goal.currency    = currency;
    if (targetDate)    goal.targetDate  = new Date(targetDate);
    if (description !== undefined) goal.description = description?.trim();

    await goal.save();
    res.json({ success: true, data: goal });
  } catch (err) { next(err); }
};

/* ── DELETE /api/savings/:id ──────────────────────────── */
exports.remove = async (req, res, next) => {
  try {
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });

    if (goal.currentAmount > 0) {
      const { accountId } = req.body;
      if (!accountId) {
        return res.status(400).json({ success: false, message: "Select an account to receive the remaining balance before deleting." });
      }
      await creditAccount(req.userId, accountId, goal.currentAmount, `إلغاء ادخار — ${goal.name}`, new Date());
    }

    await SavingsTransaction.deleteMany({ goal: goal._id });
    await goal.deleteOne();
    res.json({ success: true, message: "Goal deleted successfully." });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

/* ── POST /api/savings/:id/deposit ───────────────────── */
exports.deposit = async (req, res, next) => {
  try {
    const { amount, accountId, date, note } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, message: "Amount must be positive." });

    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });
    if (goal.status !== "active") return res.status(400).json({ success: false, message: "Goal is not active." });

    if (accountId) {
      await debitAccount(req.userId, accountId, amt, `تحويل لادخار — ${goal.name}`, date ? new Date(date) : new Date());
    }

    const txn = await SavingsTransaction.create({
      user: req.userId, goal: goal._id,
      account: accountId || null,
      type: "deposit", amount: amt,
      date: date ? new Date(date) : new Date(),
      note: note?.trim(),
    });

    goal.currentAmount = Math.min(goal.targetAmount, goal.currentAmount + amt);
    await goal.save();

    res.status(201).json({ success: true, data: { goal, transaction: txn } });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

/* ── POST /api/savings/:id/withdraw ──────────────────── */
exports.withdraw = async (req, res, next) => {
  try {
    const { amount, accountId, date, note } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, message: "Amount must be positive." });

    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });
    if (goal.currentAmount <= 0) return res.status(400).json({ success: false, message: "No balance in this goal." });
    if (amt > goal.currentAmount) return res.status(400).json({ success: false, message: "Cannot withdraw more than the current balance." });

    if (accountId) {
      await creditAccount(req.userId, accountId, amt, `سحب من ادخار — ${goal.name}`, date ? new Date(date) : new Date());
    }

    const txn = await SavingsTransaction.create({
      user: req.userId, goal: goal._id,
      account: accountId || null,
      type: "withdrawal", amount: amt,
      date: date ? new Date(date) : new Date(),
      note: note?.trim(),
    });

    goal.currentAmount -= amt;
    await goal.save();

    res.status(201).json({ success: true, data: { goal, transaction: txn } });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

/* ── POST /api/savings/:id/complete ──────────────────── */
exports.complete = async (req, res, next) => {
  try {
    const { accountId } = req.body;
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });
    if (goal.status === "completed") return res.status(400).json({ success: false, message: "Goal is already completed." });

    if (goal.currentAmount > 0 && accountId) {
      await creditAccount(req.userId, accountId, goal.currentAmount, `اكتمال هدف ادخار — ${goal.name}`, new Date());
    }

    goal.status      = "completed";
    goal.completedAt = new Date();
    await goal.save();
    res.json({ success: true, data: goal });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

/* ── POST /api/savings/:id/archive ───────────────────── */
exports.archive = async (req, res, next) => {
  try {
    const { accountId } = req.body;
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });
    if (goal.status !== "active") return res.status(400).json({ success: false, message: "Only active goals can be archived." });

    if (goal.currentAmount > 0) {
      if (!accountId) return res.status(400).json({ success: false, message: "Select an account to receive the balance before archiving." });
      await creditAccount(req.userId, accountId, goal.currentAmount, `أرشفة ادخار — ${goal.name}`, new Date());
      goal.currentAmount = 0;
    }

    goal.status     = "archived";
    goal.archivedAt = new Date();
    await goal.save();
    res.json({ success: true, data: goal });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

/* ── GET /api/savings/:id/transactions ───────────────── */
exports.getTransactions = async (req, res, next) => {
  try {
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });

    const txns = await SavingsTransaction.find({ goal: goal._id, user: req.userId })
      .populate("account", "name type color currency")
      .sort({ date: -1 });

    res.json({ success: true, data: txns });
  } catch (err) { next(err); }
};
