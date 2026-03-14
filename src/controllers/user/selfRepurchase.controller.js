import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { selfRepurchaseService } from '../../services/business/selfRepurchase.service.js';
import moment from 'moment-timezone';

// ────────────────────────────────────────────────────────────────────
// USER ENDPOINTS
// ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/user/self-repurchase-bonus/status
 * Returns the authenticated user's SRB eligibility status for the current
 * month and their last month's bonus receipt.
 */
export const getUserSRBStatus = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const data = await selfRepurchaseService.getUserSRBStatus(userId);

    return res.status(200).json(
        new ApiResponse(200, data, 'Self Repurchase Bonus status fetched successfully')
    );
});

// ────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/self-repurchase-bonus/company-bv?month=YYYY-MM
 * Returns the company-wide total BV for the specified month.
 * Query param: month = "2026-03"  (YYYY-MM format)
 */
export const getCompanyBV = asyncHandler(async (req, res) => {
    const { month } = req.query;

    let year, monthNum;

    if (month) {
        const parsed = moment(month, 'YYYY-MM', true);
        if (!parsed.isValid()) {
            throw new ApiError(400, 'Invalid month format. Use YYYY-MM (e.g. 2026-03)');
        }
        year = parsed.year();
        monthNum = parsed.month() + 1;
    } else {
        // Default to current month
        const now = moment().tz('Asia/Kolkata');
        year = now.year();
        monthNum = now.month() + 1;
    }

    const data = await selfRepurchaseService.getCompanyBVForMonth(year, monthNum);

    return res.status(200).json(
        new ApiResponse(200, data, `Company BV for ${year}-${String(monthNum).padStart(2, '0')} fetched successfully`)
    );
});

/**
 * GET /api/v1/admin/self-repurchase-bonus/distribution?month=YYYY-MM
 * Returns the pool document and per-user credit list for a given month.
 */
export const getDistributionDetails = asyncHandler(async (req, res) => {
    const { month } = req.query;

    let year, monthNum;

    if (month) {
        const parsed = moment(month, 'YYYY-MM', true);
        if (!parsed.isValid()) {
            throw new ApiError(400, 'Invalid month format. Use YYYY-MM (e.g. 2026-03)');
        }
        year = parsed.year();
        monthNum = parsed.month() + 1;
    } else {
        const now = moment().tz('Asia/Kolkata');
        year = now.year();
        monthNum = now.month() + 1;
    }

    const data = await selfRepurchaseService.getDistributionDetails(year, monthNum);

    if (!data) {
        return res.status(200).json(
            new ApiResponse(200, null, `No distribution record found for ${year}-${String(monthNum).padStart(2, '0')}`)
        );
    }

    return res.status(200).json(
        new ApiResponse(200, data, 'Distribution details fetched successfully')
    );
});

/**
 * POST /api/v1/admin/self-repurchase-bonus/trigger-distribution
 * Manually triggers the month-end distribution (idempotent — safe to retry).
 * Body: { year: 2026, month: 3 }
 */
export const triggerDistribution = asyncHandler(async (req, res) => {
    let { year, month } = req.body;

    if (!year || !month) {
        // Default to previous month if not provided
        const prev = moment().tz('Asia/Kolkata').subtract(1, 'month');
        year = year || prev.year();
        month = month || (prev.month() + 1);
    }

    year = parseInt(year);
    month = parseInt(month);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        throw new ApiError(400, 'Invalid year or month. month must be 1–12.');
    }

    const result = await selfRepurchaseService.runMonthEndDistribution(year, month);

    return res.status(200).json(
        new ApiResponse(200, result, `SRB distribution for ${year}-${String(month).padStart(2, '0')} — status: ${result.status}`)
    );
});
