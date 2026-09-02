const mongoose = require("mongoose");

const debtPaymentSchema = new mongoose.Schema(
  {
    debt:      { type: mongoose.Schema.Types.ObjectId, ref: "Debt", required: true, index: true },
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount:    { type: Number, required: true, min: 0.01 },
    date:      { type: Date, default: Date.now },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    notes:     { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DebtPayment", debtPaymentSchema);
