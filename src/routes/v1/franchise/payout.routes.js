import express from 'express';
import { protectFranchise } from '../../../middlewares/franchiseAuth.middleware.js';
import * as franchisePayoutController from '../../../controllers/franchise/franchisePayout.controller.js';

const router = express.Router();

// All routes require logged-in Franchise
router.use(protectFranchise);

// Franchise personal logs
router.route('/history').get(franchisePayoutController.getMyPayouts);

// Franchise live month tracking 
router.route('/live-bv').get(franchisePayoutController.getMyLiveBv);

export default router;
