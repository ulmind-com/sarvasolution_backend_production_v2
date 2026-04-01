import { historicalBvService } from '../../services/business/historicalBv.service.js';
import { sendResponse, sendError } from '../../utils/responseHandler.js';
import chalk from 'chalk';

/**
 * Controller for retrieving isolated Historical BV data
 */
export const getMonthlyHistoryList = async (req, res) => {
    try {
        const userId = req.user._id;
        const count = parseInt(req.query.count) || 6; // default 6 months
        
        console.log(chalk.blue(`[HistoricalBV] Fetching last ${count} monthly periods for user ${userId}`));
        
        const history = await historicalBvService.getRecentMonths(userId, count);
        return sendResponse(res, 200, 'Monthly BV history fetched successfully', history);
    } catch (error) {
        console.error(chalk.red('[HistoricalBV] Error fetching monthly history:'), error);
        return sendError(res, 500, 'Failed to fetch monthly BV history');
    }
};

export const getHalfYearlyHistoryList = async (req, res) => {
    try {
        const userId = req.user._id;
        const count = parseInt(req.query.count) || 4; // default 4 half-years (2 years)
        
        console.log(chalk.blue(`[HistoricalBV] Fetching last ${count} half-yearly periods for user ${userId}`));
        
        const history = await historicalBvService.getRecentHalfYears(userId, count);
        return sendResponse(res, 200, 'Half-Yearly BV history fetched successfully', history);
    } catch (error) {
        console.error(chalk.red('[HistoricalBV] Error fetching half-yearly history:'), error);
        return sendError(res, 500, 'Failed to fetch half-yearly BV history');
    }
};

export const getYearlyHistoryList = async (req, res) => {
    try {
        const userId = req.user._id;
        const count = parseInt(req.query.count) || 3; // default 3 years
        
        console.log(chalk.blue(`[HistoricalBV] Fetching last ${count} yearly periods for user ${userId}`));
        
        const history = await historicalBvService.getRecentYears(userId, count);
        return sendResponse(res, 200, 'Yearly BV history fetched successfully', history);
    } catch (error) {
        console.error(chalk.red('[HistoricalBV] Error fetching yearly history:'), error);
        return sendError(res, 500, 'Failed to fetch yearly BV history');
    }
};
