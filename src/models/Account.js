const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name:     { type: String, required: true, trim: true, maxlength: 100 },
    type:     { type: String, enum: ["bank", "wallet", "cash"], required: true },
    balance:  { type: Number, default: 0 },
    currency: { type: String, default: "EGP", maxlength: 10 },
    color:    { type: String, default: "#0d9488" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique name per user
accountSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Account", accountSchema);
