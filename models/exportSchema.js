import mongoose from 'mongoose';


const exportRequestSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // ref User model
            required: true,
        },
        format: {
            type: String,
            enum: ['csv', 'json', 'ics'],
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending',
            required: true,
        },
        password: {
            type: String,
            required: true
        },
        fileUrl: {
            type: String,
            required: function () {
                return this.status === 'completed';
            },
        },
        error: {
            type: String,
            required: function () {
                return this.status === 'failed';
            },
        },
        requestedAt: { type: Date, default: Date.now },
        completedAt: { type: Date },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        }
    },
    { timestamps: true }
);


// indexed for faster queries
exportRequestSchema.index({ user: 1, status: 1 });
exportRequestSchema.index({ format: 1 });

export default mongoose.model('ExportRequest', exportRequestSchema);
