const mongoose = require("mongoose");
const { Schema } = mongoose;

const adminLogSchema = new Schema({
  admin:   { type: Schema.Types.ObjectId, ref: "Admin" },
  user:    { type: Schema.Types.ObjectId, ref: "User", required: true },
  action:  {
    type: String,
    enum: ["create_user","extend_subscription","change_plan","add_free_days","suspend","activate","manual_date"],
    required: true,
  },
  details: { type: Schema.Types.Mixed },
  reason:  { type: String, maxlength: 500 },
}, { timestamps: true });

adminLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("AdminLog", adminLogSchema);
