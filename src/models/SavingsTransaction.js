const mongoose = require("mongoose");
const { Schema } = mongoose;

const savingsTransactionSchema = new Schema({
  user:    { type: Schema.Types.ObjectId, ref: "User",         required: true, index: true },
  goal:    { type: Schema.Types.ObjectId, ref: "SavingsGoal",  required: true },
  account: { type: Schema.Types.ObjectId, ref: "Account" },
  type:    { type: String, enum: ["deposit", "withdrawal"],    required: true },
  amount:  { type: Number, required: true, min: 0.01 },
  date:    { type: Date, default: Date.now },
  note:    { type: String, maxlength: 300 },
}, { timestamps: true });

module.exports = mongoose.model("SavingsTransaction", savingsTransactionSchema);
