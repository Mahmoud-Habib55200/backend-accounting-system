const mongoose = require("mongoose");

const incomeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: {
      type: String,
      enum: ["salary", "freelance", "rental", "investment", "other"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "EGP", maxlength: 10 },
    receivedDate: { type: Date, required: true },
    recurrence: {
      type: String,
      enum: ["once", "weekly", "monthly", "yearly"],
      default: "once",
    },
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["cleared", "pending"],
      default: "cleared",
    },
    notes:   { type: String, trim: true, maxlength: 500 },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Income", incomeSchema);
