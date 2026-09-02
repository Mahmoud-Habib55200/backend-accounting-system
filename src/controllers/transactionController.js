const Transaction = require("../models/Transaction");

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;
    const filter = { userId: req.userId };
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const total = await Transaction.countDocuments(filter);
    const data = await Transaction.find(filter)
      .populate("category")
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      data,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId }).populate("category");
    if (!tx) return res.status(404).json({ success: false, message: "Transaction not found" });
    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const tx = await Transaction.create({ ...req.body, userId: req.userId });
    res.status(201).json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const tx = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!tx) return res.status(404).json({ success: false, message: "Transaction not found" });
    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const tx = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!tx) return res.status(404).json({ success: false, message: "Transaction not found" });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
