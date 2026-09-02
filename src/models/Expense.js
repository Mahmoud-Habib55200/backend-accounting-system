const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount:      { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    date:        { type: Date,   required: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "wallet"],
      required: true,
    },
    expenseType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "fixed", "emergency"],
      required: true,
    },
    category: { type: String, required: true, trim: true },
    currency:  { type: String, default: "EGP", maxlength: 10 },
    notes:     { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["confirmed", "pending"],
      default: "confirmed",
    },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);
