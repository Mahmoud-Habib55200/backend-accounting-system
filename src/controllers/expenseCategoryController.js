const ExpenseCategory = require("../models/ExpenseCategory");

exports.list = async (req, res, next) => {
  try {
    const cats = await ExpenseCategory.find({ user: req.userId }).sort({ createdAt: 1 });
    res.json({ success: true, data: cats });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required" });
    const cat = await ExpenseCategory.create({ user: req.userId, name: name.trim(), color: color || "#6b7280" });
    res.status(201).json({ success: true, data: cat });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const cat = await ExpenseCategory.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!cat) return res.status(404).json({ success: false, message: "Category not found" });
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const cat = await ExpenseCategory.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!cat) return res.status(404).json({ success: false, message: "Category not found" });
    res.json({ success: true, message: "Category deleted" });
  } catch (err) { next(err); }
};
