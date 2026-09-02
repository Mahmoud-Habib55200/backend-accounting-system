const mongoose = require("mongoose");

const debtSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    creditor:     { type: String, required: true, trim: true },
    category:     { type: String, enum: ["credit_card","auto_loan","personal","student","mortgage","other"], default: "other" },
    totalAmount:  { type: Number, required: true, min: 0 },
    paidAmount:   { type: Number, default: 0, min: 0 },
    currency:     { type: String, default: "EGP" },
    interestRate: { type: Number, default: 0, min: 0 },   // APR %
    startDate:    { type: Date, default: Date.now },
    dueDate:      { type: Date, default: null },
    description:  { type: String, trim: true, default: "" },
    status:       { type: String, enum: ["active", "paid", "overdue"], default: "active" },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

debtSchema.virtual("remainingAmount").get(function () {
  return Math.max(0, this.totalAmount - this.paidAmount);
});

debtSchema.virtual("progressPct").get(function () {
  if (!this.totalAmount) return 0;
  return Math.min(100, (this.paidAmount / this.totalAmount) * 100);
});

module.exports = mongoose.model("Debt", debtSchema);
