const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    type:    { type: String, enum: ["credit", "debit", "adjustment"], required: true },
    amount:  { type: Number, required: true },
    description:   { type: String, required: true, trim: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter:  { type: Number, required: true },
    date:          { type: Date, default: Date.now },
    relatedModel:  { type: String, enum: ["Expense", "Income"], default: null },
    relatedId:     { type: mongoose.Schema.Types.ObjectId, default: null },
    notes:         { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccountTransaction", schema);
