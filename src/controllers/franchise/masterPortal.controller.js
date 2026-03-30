import MasterFranchiseRelation from '../../models/MasterFranchiseRelation.model.js';
import FranchiseInventory from '../../models/FranchiseInventory.model.js';
import MasterStockTransfer from '../../models/MasterStockTransfer.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { getLiveProjectedEarnings } from '../../services/business/masterPayout.service.js';
import mongoose from 'mongoose';

/**
 * Get Sub-Franchise Network for the logged-in Master Franchise
 * @route GET /api/v1/franchise/master-portal/network
 */
export const getMySubNetwork = asyncHandler(async (req, res) => {
    const masterId = req.franchise._id;

    const relation = await MasterFranchiseRelation.findOne({ masterId, isActive: true })
        .populate('subFranchises', 'name shopName vendorId city phone email status');

    if (!relation) {
        return res.status(200).json(
            new ApiResponse(200, { isMaster: false, subFranchises: [] }, 'Not a Master Franchise')
        );
    }

    return res.status(200).json(
        new ApiResponse(200, {
            isMaster: true,
            subFranchises: relation.subFranchises
        }, 'Sub-franchise network fetched successfully')
    );
});

/**
 * Transfer Stock from Master to Sub-Franchise
 * @route POST /api/v1/franchise/master-portal/transfer-stock
 */
export const transferStock = asyncHandler(async (req, res) => {
    const masterId = req.franchise._id;
    const { subFranchiseId, productId, quantity } = req.body;

    if (!subFranchiseId || !productId || !quantity || quantity <= 0) {
        throw new ApiError(400, 'Sub-franchise, Product, and valid Quantity are required');
    }

    // Verify Master Relation
    const relation = await MasterFranchiseRelation.findOne({ masterId, isActive: true });
    if (!relation) {
        throw new ApiError(403, 'You are not authorized as a Master Franchise');
    }

    if (!relation.subFranchises.includes(subFranchiseId)) {
        throw new ApiError(400, 'The selected franchise is not in your sub-network');
    }

    // Start Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Check Master's Inventory
        const masterInv = await FranchiseInventory.findOne({ franchise: masterId, product: productId }).session(session);
        
        if (!masterInv || masterInv.stockQuantity < quantity) {
            throw new ApiError(400, 'Insufficient stock to complete this transfer');
        }

        // 2. Deduct from Master
        masterInv.stockQuantity -= quantity;
        await masterInv.save({ session });

        // 3. Add to Sub-Franchise (Upsert if missing)
        const subInv = await FranchiseInventory.findOneAndUpdate(
            { franchise: subFranchiseId, product: productId },
            { 
                $inc: { stockQuantity: quantity },
                $setOnInsert: { purchasePrice: masterInv.purchasePrice || 0 } // Inherit master's purchase price
            },
            { new: true, upsert: true, session }
        );

        // 4. Log Transfer
        const transferLog = await MasterStockTransfer.create([{
            fromMasterId: masterId,
            toSubFranchiseId: subFranchiseId,
            product: productId,
            quantityTransferred: quantity,
            transferNotes: `Transferred by Master ${req.franchise.shopName}`
        }], { session });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json(
            new ApiResponse(200, transferLog[0], 'Stock transferred successfully')
        );
        
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
});

/**
 * Get Stock Transfer History
 * @route GET /api/v1/franchise/master-portal/transfer-history
 */
export const getTransferHistory = asyncHandler(async (req, res) => {
    const masterId = req.franchise._id;

    const history = await MasterStockTransfer.find({ fromMasterId: masterId })
        .populate('toSubFranchiseId', 'shopName vendorId')
        .populate('product', 'productName productId')
        .sort({ transferDate: -1 })
        .limit(50); // limit to recent 50 for performance

    return res.status(200).json(
        new ApiResponse(200, history, 'Stock transfer history fetched')
    );
});

/**
 * Get Live MTD Earnings Projection
 * @route GET /api/v1/franchise/master-portal/live-earnings
 */
export const getLiveEarnings = asyncHandler(async (req, res) => {
    const masterId = req.franchise._id;
    const liveData = await getLiveProjectedEarnings(masterId);

    if (!liveData.isActiveMaster) {
        throw new ApiError(403, 'Not authorized as active Master Franchise');
    }

    return res.status(200).json(
        new ApiResponse(200, liveData, 'Live projected earnings calculated')
    );
});
