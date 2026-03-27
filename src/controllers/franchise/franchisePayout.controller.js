import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import FranchisePayout from '../../models/FranchisePayout.model.js';
import FranchiseBvState from '../../models/FranchiseBvState.model.js';

/**
 * Get Franchise's Own Payout History
 */
export const getMyPayouts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const franchiseId = req.franchise._id; // Extracted from franchise auth middleware

    const query = { franchiseId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payouts = await FranchisePayout.find(query)
        .sort({ year: -1, month: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await FranchisePayout.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, {
            payouts,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        }, 'Your payout history fetched successfully')
    );
});

/**
 * Get Franchise's Live BV State for this month
 */
export const getMyLiveBv = asyncHandler(async (req, res) => {
    const franchiseId = req.franchise._id;

    // We use findOneAndUpdate to ensure the record exists safely, but we do not mutate it here
    const state = await FranchiseBvState.findOneAndUpdate(
        { franchiseId },
        { $setOnInsert: { currentMonthRepurchaseBv: 0, lifetimeRepurchaseBv: 0 } },
        { upsert: true, new: true }
    );

    // Compute live estimation (Optional but helpful for UI)
    const generatedBv = state.currentMonthRepurchaseBv;
    const grossPayout = generatedBv * 0.10;
    const adminCharge = grossPayout * 0.05;
    const tdsCharge = grossPayout * 0.02;
    const netPayout = grossPayout - adminCharge - tdsCharge;

    return res.status(200).json(
        new ApiResponse(200, {
            currentMonthBv: state.currentMonthRepurchaseBv,
            lifetimeBv: state.lifetimeRepurchaseBv,
            liveEstimates: {
                estimatedGrossPayout: parseFloat(grossPayout.toFixed(2)),
                estimatedAdminCharge: parseFloat(adminCharge.toFixed(2)),
                estimatedTdsCharge: parseFloat(tdsCharge.toFixed(2)),
                estimatedNetPayout: parseFloat(netPayout.toFixed(2)),
                payoutCycle: 'Month-End'
            }
        }, 'Live BV status fetched successfully')
    );
});
