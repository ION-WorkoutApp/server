import mongoose from 'mongoose';


const UsedEmails = new mongoose.Schema(
    {
        email: { type: String, required: true },
        reason: { type: String, required: true },
    },
    { timestamps: true }
)

UsedEmails.index({ format: 1 });
export default mongoose.model('UsedEmails', UsedEmails);