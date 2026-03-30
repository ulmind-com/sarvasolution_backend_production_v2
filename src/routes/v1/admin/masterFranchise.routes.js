import express from 'express';
import authMiddleware from '../../../middlewares/auth/authMiddleware.js';
import adminMiddleware from '../../../middlewares/auth/adminMiddleware.js';
import {
    assignMasterFranchise,
    getMasterFranchiseList,
    removeMasterFranchise,
    getAvailableFranchises,
    getLiveEarnings
} from '../../../controllers/admin/masterFranchise.controller.js';

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get('/eligible', getAvailableFranchises);
router.post('/', assignMasterFranchise);
router.get('/', getMasterFranchiseList);
router.get('/:masterId/live-earnings', getLiveEarnings);
router.delete('/:relationId', removeMasterFranchise);

export default router;
