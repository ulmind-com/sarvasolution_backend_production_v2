import express from 'express';
import { franchiseAuth } from '../../../middlewares/auth/franchiseAuthMiddleware.js';
import {
    getMySubNetwork,
    transferStock,
    getTransferHistory,
    getLiveEarnings
} from '../../../controllers/franchise/masterPortal.controller.js';

const router = express.Router();

router.use(franchiseAuth);

router.get('/network', getMySubNetwork);
router.post('/transfer-stock', transferStock);
router.get('/transfer-history', getTransferHistory);
router.get('/live-earnings', getLiveEarnings);

export default router;
