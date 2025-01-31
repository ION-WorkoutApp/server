import express from 'express';
import { User } from '../models/userSchema.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// all paths should use auth
router.use(verifyToken);


router.post('/logout', async (req, res) => {
    try {
        await User.findOneAndUpdate({ _id: req.user.id }, { $unset: { refreshToken: 1 } });
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to log out', error: err.message });
    }
});


router.get('/userdata', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email }).lean();
        if (user) {
            res.json(user);
        } else {
            res.status(400).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve user details', error: err.message });
    }
});


router.put('/updatedetails', async (req, res) => {
    try {
        // Validate the incoming data here?

        // Perform the update
        const updatedUser = await User.findOneAndUpdate(
            { email: req.user.email },
            { $set: req.body }, // This allows updating nested fields
            { new: true, runValidators: true } // Return the updated document
        ).lean();

        if (updatedUser) {
            res.json({
                message: 'Account details updated successfully',
                user: updatedUser
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({
            message: 'Failed to update account details',
            error: err.message
        });
    }
});



router.delete('/deleteaccount', async (req, res) => {
    try {
        const result = await User.deleteOne({ email: req.user.email });
        if (result.deletedCount > 0) {
            res.sendStatus(200);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({
            message: 'Failed to delete account',
            error: err.message
        });
    }
});


export default router;
