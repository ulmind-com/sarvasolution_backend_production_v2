import express from 'express';
import { getBVSummary, getFundsStatus, requestPayout, getWalletInfo, getTree, getPayouts, getBonusStatus, getFastTrackBonusStatus, getStarMatchingBonusStatus, getMyWalletAdjustments, getTreeBVSummary, getPublicTreeBVSummary } from '../../../controllers/user/userFinancial.controller.js';
import { getUserProducts, getProductDetails } from '../../../controllers/user/product.controller.js';
import { getUserSRBStatus, getUserPersonalRepurchaseBV } from '../../../controllers/user/selfRepurchase.controller.js';
import { getMyBBStatus, getMyBBHistory, getPublicBBStatus, getMyLiveEstimate } from '../../../controllers/user/beginnerBonus.controller.js';
import { getMySubStatus, getMySubHistory, getPublicSubStatus, getMySubLiveEstimate } from '../../../controllers/user/startUpBonus.controller.js';
import { getMyLBStatus, getMyLBHistory, getPublicLBStatus, getMyLBLiveEstimate } from '../../../controllers/user/leadershipBonus.controller.js';
import authMiddleware from '../../../middlewares/auth/authMiddleware.js';

const router = express.Router();

// Public Routes (No Authentication Required)
router.get('/products/:productId', getProductDetails);
router.get('/tree-bv-summary/:memberId', getPublicTreeBVSummary);
router.get('/beginner-bonus/status/:memberId', getPublicBBStatus);
router.get('/startup-bonus/status/:memberId', getPublicSubStatus);
router.get('/leadership-bonus/status/:memberId', getPublicLBStatus); // Public Leadership Bonus status

// Protected Routes (Authentication Required)
router.use(authMiddleware);

router.get('/bv-summary', getBVSummary);
router.get('/tree-bv-summary', getTreeBVSummary); // New: Date-bucketed left/right BV totals
router.get('/funds-status', getFundsStatus);

router.get('/wallet', getWalletInfo);
router.get('/tree', getTree);
router.get('/tree_view', getTree); // Alias for easy tree implementation
router.get('/tree/:memberId', getTree);
router.get('/payouts', getPayouts);
router.get('/wallet-adjustments', getMyWalletAdjustments);
router.get('/bonus-status', getBonusStatus); // Combined (Legacy/Overview)
router.get('/fast-track-status', getFastTrackBonusStatus); // New: Fast Track Specific
router.get('/star-matching-status', getStarMatchingBonusStatus); // New: Star Matching Specific
router.post('/request-payout', requestPayout);

// Self Repurchase Bonus
router.get('/self-repurchase-bonus/status', getUserSRBStatus);
router.get('/self-repurchase-bonus/personal-bv', getUserPersonalRepurchaseBV);

// Beginner Bonus
router.get('/beginner-bonus/status', getMyBBStatus);
router.get('/beginner-bonus/history', getMyBBHistory);
router.get('/beginner-bonus/live-estimate', getMyLiveEstimate);

// Start Up Bonus
router.get('/startup-bonus/status', getMySubStatus);
router.get('/startup-bonus/history', getMySubHistory);
router.get('/startup-bonus/live-estimate', getMySubLiveEstimate);

// Leadership Bonus
router.get('/leadership-bonus/status', getMyLBStatus);
router.get('/leadership-bonus/history', getMyLBHistory);
router.get('/leadership-bonus/live-estimate', getMyLBLiveEstimate);

// Product Browsing (authenticated)
router.get('/products', getUserProducts);

import { getDirectTeam, getCompleteTeam } from '../../../controllers/user/user.controller.js';
import { activateUser } from '../../../controllers/user/activate_user.controller.js';

router.post('/activate', activateUser);
router.get('/direct-team', getDirectTeam); // New Route for Direct Team List
router.get('/team/complete', getCompleteTeam); // Recursively fetch complete team by leg

import { getMyPurchases } from '../../../controllers/user/purchase.controller.js';

router.get('/purchases', getMyPurchases);

import { changePassword } from '../../../controllers/user/password.controller.js';

router.put('/change-password', changePassword);

export default router;
