import express from 'express';
import { User } from '../models/userSchema.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// all paths should use auth
router.use(verifyToken);


// route to log out (protected)
router.post('/logout', async (req, res) => {
    try {
        await User.findOneAndUpdate({ _id: req.user.id }, { $unset: { refreshToken: 1 } });
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to log out', error: err.message });
    }
});

// route to get account details (protected)
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

// route to update account details (protected)
router.put('/updatedetails', async (req, res) => {
    try {
        const updatedUser = await User.findOneAndUpdate(
            { email: req.user.email },
            { $set: req.body },
            { new: true }
        );

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

// route to delete account (protected)
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
