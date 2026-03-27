import express from 'express';
import { getAllUsers, getUserByMemberId, updateUserByAdmin, verifyKYC, changeUserPassword, getUsersKYCDetails } from '../../../controllers/admin/adminUser.controller.js';

import { getDashboardMetrics, processPayout, addManualBV, getPayouts, getAllTransactions, triggerBonusMatching, acceptPayout, rejectPayout, getAllUserWallets, getAllWalletLogs, getTreeBVSummary } from '../../../controllers/admin/adminManager.controller.js';
import { fixDatabaseIssues } from '../../../controllers/admin/fixDatabase.controller.js';
import { getCompanyBV, getDistributionDetails, triggerDistribution, getLivePool, getEligibleUsersHistory, getCompanyBVHistory } from '../../../controllers/user/selfRepurchase.controller.js';
import authMiddleware from '../../../middlewares/auth/authMiddleware.js';
import adminMiddleware from '../../../middlewares/auth/adminMiddleware.js';
import { listBBPools, getBBPoolDetail, getAdminUserBBDetails, listAllUsersBB, triggerBBDistribution, applyBBWalletCredits, getLiveBBPool } from '../../../controllers/admin/beginnerBonus.controller.js';
import { listSubPools, getSubPoolDetail, getAdminUserSubDetails, listAllUsersSubBonus, getLiveSubPool, triggerSubDistribution, applySubWalletCredits } from '../../../controllers/admin/startUpBonus.controller.js';
import { listLBPools, getLBPoolDetail, getAdminUserLBDetails, listAllUsersLB, getLiveLBPool, triggerLBDistribution, applyLBWalletCredits } from '../../../controllers/admin/leadershipBonus.controller.js';
import { listTFPools, getTFPoolDetail, getAdminUserTFDetails, listAllUsersTF, getLiveTFPool, triggerTFDistribution, applyTFWalletCredits } from '../../../controllers/admin/tourFund.controller.js';
import { listHEBPools, getHEBPoolDetail, getAdminUserHEBDetails, listAllUsersHEB, getLiveHEBPool, triggerHEBDistribution, applyHEBWalletCredits } from '../../../controllers/admin/healthEducationBonus.controller.js';
import { listBCFPools, getBCFPoolDetail, getAdminUserBCFDetails, listAllUsersBCF, getLiveBCFPool, triggerBCFDistribution, applyBCFWalletCredits } from '../../../controllers/admin/bikeCarFund.controller.js';
import * as houseFundController from '../../../controllers/admin/houseFund.controller.js';
import * as royaltyFundController from '../../../controllers/admin/royaltyFund.controller.js';


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
router.get('/tree-bv-summary/:memberId', getTreeBVSummary); // New: View user's left/right downline BV summary


import { adjustWalletBalance, getWalletAdjustmentLogs } from '../../../controllers/admin/adminWallet.controller.js';
router.post('/wallet/adjust', adjustWalletBalance);
router.get('/wallet/adjustment-logs', getWalletAdjustmentLogs);



// Self Repurchase Bonus (Admin)
router.get('/self-repurchase-bonus/live-pool', getLivePool);
router.get('/self-repurchase-bonus/company-bv', getCompanyBV);
router.get('/self-repurchase-bonus/bv-history', getCompanyBVHistory);
router.get('/self-repurchase-bonus/eligible-users', getEligibleUsersHistory);
router.get('/self-repurchase-bonus/distribution', getDistributionDetails);
router.post('/self-repurchase-bonus/trigger-distribution', triggerDistribution);

router.get('/beginner-bonus/pools', listBBPools);
router.get('/beginner-bonus/pools/:year/:month', getBBPoolDetail);
router.get('/beginner-bonus/users', listAllUsersBB);
router.get('/beginner-bonus/users/:memberId', getAdminUserBBDetails);
router.get('/beginner-bonus/live-pool', getLiveBBPool);
router.post('/beginner-bonus/trigger', triggerBBDistribution);
router.post('/beginner-bonus/apply-credits', applyBBWalletCredits);

// Start Up Bonus (Admin)
router.get('/startup-bonus/pools', listSubPools);
router.get('/startup-bonus/pools/:year/:month', getSubPoolDetail);
router.get('/startup-bonus/users', listAllUsersSubBonus);
router.get('/startup-bonus/users/:memberId', getAdminUserSubDetails);
router.get('/startup-bonus/live-pool', getLiveSubPool);
router.post('/startup-bonus/trigger', triggerSubDistribution);
router.post('/startup-bonus/apply-credits', applySubWalletCredits);

// Leadership Bonus (Admin)
router.get('/leadership-bonus/pools', listLBPools);
router.get('/leadership-bonus/pools/:year/:month', getLBPoolDetail);
router.get('/leadership-bonus/users', listAllUsersLB);
router.get('/leadership-bonus/users/:memberId', getAdminUserLBDetails);
router.get('/leadership-bonus/live-pool', getLiveLBPool);
router.post('/leadership-bonus/trigger', triggerLBDistribution);
router.post('/leadership-bonus/apply-credits', applyLBWalletCredits);

// Tour Fund (Admin)
router.get('/tour-fund/pools', listTFPools);
router.get('/tour-fund/pools/:year/:month', getTFPoolDetail);
router.get('/tour-fund/users', listAllUsersTF);
router.get('/tour-fund/users/:memberId', getAdminUserTFDetails);
router.get('/tour-fund/live-pool', getLiveTFPool);
router.post('/tour-fund/trigger', triggerTFDistribution);
router.post('/tour-fund/apply-credits', applyTFWalletCredits);

// Health & Education Bonus (Admin)
router.get('/health-education-bonus/pools', listHEBPools);
router.get('/health-education-bonus/pools/:year/:month', getHEBPoolDetail);
router.get('/health-education-bonus/users', listAllUsersHEB);
router.get('/health-education-bonus/users/:memberId', getAdminUserHEBDetails);
router.get('/health-education-bonus/live-pool', getLiveHEBPool);
router.post('/health-education-bonus/trigger', triggerHEBDistribution);
router.post('/health-education-bonus/apply-credits', applyHEBWalletCredits);

// Bike & Car Fund (Admin)
router.get('/bike-car-fund/pools', listBCFPools);
router.get('/bike-car-fund/pools/:year/:month', getBCFPoolDetail);
router.get('/bike-car-fund/users', listAllUsersBCF);
router.get('/bike-car-fund/users/:memberId', getAdminUserBCFDetails);
router.get('/bike-car-fund/live-pool', getLiveBCFPool);
router.post('/bike-car-fund/trigger', triggerBCFDistribution);
router.post('/bike-car-fund/apply-credits', applyBCFWalletCredits);

// House Fund (Admin)
router.get('/house-fund/pools', houseFundController.getPoolList);
router.get('/house-fund/pools/:cycleYear/:cycleNumber', houseFundController.getPoolDetails);
router.get('/house-fund/users', houseFundController.getCurrentCycleOverview);
router.get('/house-fund/users/:memberId', houseFundController.getUserDetails);
router.get('/house-fund/live-pool', houseFundController.getLivePool);
router.post('/house-fund/trigger', houseFundController.triggerDistribution);
router.post('/house-fund/apply-credits', houseFundController.applyWalletCredits);

// Royalty Fund (Admin)
router.get('/royalty-fund/pools', royaltyFundController.getPoolList);
router.get('/royalty-fund/pools/:cycleYear', royaltyFundController.getPoolDetails);
router.get('/royalty-fund/users', royaltyFundController.getCurrentCycleOverview);
router.get('/royalty-fund/users/:memberId', royaltyFundController.getUserDetails);
router.get('/royalty-fund/live-pool', royaltyFundController.getLivePool);
router.post('/royalty-fund/trigger', royaltyFundController.triggerDistribution);
router.post('/royalty-fund/apply-credits', royaltyFundController.applyWalletCredits);


// Sub-Modules
router.use('/product', productRoutes);
router.use('/franchise', franchiseRoutes);
router.use('/sales', saleRoutes);
router.use('/requests', requestRoutes); // Pluralized to match user preference


export default router;

