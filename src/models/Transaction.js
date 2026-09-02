const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["income", "expense", "debt_payment"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "EGP" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    description: { type: String, trim: true, default: "" },
    date: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ["completed", "pending", "cancelled"],
      default: "completed",
    },
    debtId: { type: mongoose.Schema.Types.ObjectId, ref: "Debt", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
