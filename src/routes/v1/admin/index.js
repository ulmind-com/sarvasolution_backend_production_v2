import express from 'express';
import { getAllUsers, getUserByMemberId, updateUserByAdmin, verifyKYC, changeUserPassword, getUsersKYCDetails } from '../../../controllers/admin/adminUser.controller.js';

import { getDashboardMetrics, processPayout, addManualBV, getPayouts, getAllTransactions, triggerBonusMatching, acceptPayout, rejectPayout, getAllUserWallets, getAllWalletLogs } from '../../../controllers/admin/adminManager.controller.js';
import { fixDatabaseIssues } from '../../../controllers/admin/fixDatabase.controller.js';
import { getCompanyBV, getDistributionDetails, triggerDistribution, getLivePool, getEligibleUsersHistory, getCompanyBVHistory } from '../../../controllers/user/selfRepurchase.controller.js';
import authMiddleware from '../../../middlewares/auth/authMiddleware.js';
import adminMiddleware from '../../../middlewares/auth/adminMiddleware.js';

import productRoutes from './productRoutes.js';
import franchiseRoutes from './franchiseRoutes.js';
import saleRoutes from './saleRoutes.js';
import requestRoutes from './requestRoutes.js';

const router = express.Router();

// All routes here require both authentication and admin role
router.use(authMiddleware, adminMiddleware);

// User Management
router.get('/users', getAllUsers);
router.get('/users/kyc-details', getUsersKYCDetails);
router.get('/users/:memberId', getUserByMemberId);

router.patch('/users/:memberId', updateUserByAdmin);
router.patch('/users/:memberId/change-password', changeUserPassword);
router.patch('/kyc/verify/:memberId', verifyKYC);

// System Management
router.get('/dashboard-metrics', getDashboardMetrics);
router.get('/payouts', getPayouts);
router.post('/payouts/process', processPayout); // Legacy endpoint for backward compatibility
router.patch('/payouts/:payoutId/accept', acceptPayout); // New: Accept payout
router.patch('/payouts/:payoutId/reject', rejectPayout); // New: Reject payout
router.get('/transactions', getAllTransactions); // New Audit Route
router.post('/bv/allocate-manual', addManualBV);
router.post('/trigger-bonus', triggerBonusMatching);
router.post('/fix-database', fixDatabaseIssues); // Fix data inconsistencies
router.get('/user-wallets', getAllUserWallets);  // New: View all user wallets
router.get('/wallet-logs', getAllWalletLogs);    // New: View all user wallet logs grouped by day

import { adjustWalletBalance, getWalletAdjustmentLogs } from '../../../controllers/admin/adminWallet.controller.js';
router.post('/wallet/adjust', adjustWalletBalance);
router.get('/wallet/adjustment-logs', getWalletAdjustmentLogs);



// Self Repurchase Bonus (Admin)
router.get('/self-repurchase-bonus/live-pool', getLivePool);          // 🔴 Current month eligible users
router.get('/self-repurchase-bonus/company-bv', getCompanyBV);
router.get('/self-repurchase-bonus/bv-history', getCompanyBVHistory); // 📊 All months BV history
router.get('/self-repurchase-bonus/eligible-users', getEligibleUsersHistory); // 📋 Month-wise eligibility
router.get('/self-repurchase-bonus/distribution', getDistributionDetails);
router.post('/self-repurchase-bonus/trigger-distribution', triggerDistribution);

// Sub-Modules
router.use('/product', productRoutes);
router.use('/franchise', franchiseRoutes);
router.use('/sales', saleRoutes);
router.use('/requests', requestRoutes); // Pluralized to match user preference


export default router;

