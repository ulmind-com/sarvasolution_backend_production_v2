import express from 'express';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import * as franchisePayoutController from '../../../controllers/admin/franchisePayout.controller.js';

const router = express.Router();

// All routes require Admin privileges
router.use(protect);
router.use(authorize('admin', 'super-admin'));

// Audit List of specific generated payouts
router.route('/list').get(franchisePayoutController.getFranchisePayouts);

// Live viewing of ongoing month BV accumulations
router.route('/live-bv').get(franchisePayoutController.getLiveFranchiseBvStates);

// Manual Fulfillment Action
router.route('/:id/mark-paid').patch(franchisePayoutController.markPayoutPaid);

export default router;
