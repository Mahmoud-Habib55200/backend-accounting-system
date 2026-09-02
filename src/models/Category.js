const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    icon: { type: String, default: null },
    color: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
