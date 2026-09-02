const mongoose = require("mongoose");
const { Schema } = mongoose;

const savingsGoalSchema = new Schema({
  user:          { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name:          { type: String, required: true, trim: true, maxlength: 100 },
  emoji:         { type: String, default: "PiggyBank", maxlength: 30 },
  targetAmount:  { type: Number, required: true, min: 0.01 },
  currentAmount: { type: Number, default: 0, min: 0 },
  currency:      { type: String, default: "EGP" },
  targetDate:    { type: Date },
  description:   { type: String, maxlength: 500 },
  status:        { type: String, enum: ["active", "completed", "archived"], default: "active" },
  completedAt:   { type: Date },
  archivedAt:    { type: Date },
}, { timestamps: true });

savingsGoalSchema.index({ user: 1, name: 1 }, { unique: true });

savingsGoalSchema.virtual("remainingAmount").get(function () {
  return Math.max(0, this.targetAmount - this.currentAmount);
});
savingsGoalSchema.virtual("progressPct").get(function () {
  if (!this.targetAmount) return 0;
  return Math.min(100, (this.currentAmount / this.targetAmount) * 100);
});

savingsGoalSchema.set("toJSON",   { virtuals: true });
savingsGoalSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("SavingsGoal", savingsGoalSchema);
