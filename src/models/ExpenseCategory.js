const mongoose = require("mongoose");

const expenseCategorySchema = new mongoose.Schema(
  {
    user:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name:  { type: String, required: true, trim: true, maxlength: 50 },
    color: { type: String, default: "#6b7280" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExpenseCategory", expenseCategorySchema);
