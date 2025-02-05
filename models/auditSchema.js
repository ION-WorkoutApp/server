import mongoose from "mongoose";

const adminActivitySchema = new mongoose.Schema({
	admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	action: { type: String, required: true }, // e.g., "Viewed user data"
	targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	timestamp: { type: Date, default: Date.now }
});

export const AdminActivity = mongoose.model('AdminActivity', adminActivitySchema);
