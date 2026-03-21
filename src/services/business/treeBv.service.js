import moment from 'moment-timezone';
import BVTransaction from '../../models/BVTransaction.model.js';
import User from '../../models/User.model.js';
import { ApiError } from '../../utils/ApiError.js';

const TIMEZONE = 'Asia/Kolkata';

/**
 * Calculates date boundaries for Current Month, Half-Year, and Annual periods.
 * Base logic:
 * - Half-yearly periods: April 1 to Sept 30, Oct 1 to March 31.
 * - Annual period: April 1 to March 31.
 */
const getDateBoundaries = () => {
    const now = moment().tz(TIMEZONE);
    const currentMonth = now.month(); // 0-indexed: 0=Jan, 11=Dec
    const currentYear = now.year();

    // 1. Current Month
    const startOfCurrentMonth = now.clone().startOf('month');
    const endOfCurrentMonth = now.clone().endOf('month');

    // 2. Half-Yearly
    let startOfHalfYear, endOfHalfYear;
    if (currentMonth >= 3 && currentMonth <= 8) {
        // April 1 to September 30
        startOfHalfYear = now.clone().month(3).date(1).startOf('day');
        endOfHalfYear = now.clone().month(8).date(30).endOf('day');
    } else {
        // October 1 to March 31
        if (currentMonth < 3) {
            // Jan-Mar: Oct of PREVIOUS year to Mar of CURRENT year
            startOfHalfYear = now.clone().subtract(1, 'year').month(9).date(1).startOf('day');
            endOfHalfYear = now.clone().month(2).date(31).endOf('day');
        } else {
            // Oct-Dec: Oct of CURRENT year to Mar of NEXT year
            startOfHalfYear = now.clone().month(9).date(1).startOf('day');
            endOfHalfYear = now.clone().add(1, 'year').month(2).date(31).endOf('day');
        }
    }

    // 3. Annually
    let startOfAnnual, endOfAnnual;
    if (currentMonth >= 3) {
        // April-Dec: April of CURRENT year to Mar of NEXT year
        startOfAnnual = now.clone().month(3).date(1).startOf('day');
        endOfAnnual = now.clone().add(1, 'year').month(2).date(31).endOf('day');
    } else {
        // Jan-Mar: April of PREVIOUS year to Mar of CURRENT year
        startOfAnnual = now.clone().subtract(1, 'year').month(3).date(1).startOf('day');
        endOfAnnual = now.clone().month(2).date(31).endOf('day');
    }

    return {
        currentMonth: { start: startOfCurrentMonth.toDate(), end: endOfCurrentMonth.toDate() },
        halfYearly: { start: startOfHalfYear.toDate(), end: endOfHalfYear.toDate() },
        annually: { start: startOfAnnual.toDate(), end: endOfAnnual.toDate() },
        currentDate: now.toDate()
    };
};

/**
 * Service to calculate Left/Right Downline accumulated BV totals according to time slices.
 */
export const treeBvService = {
    getTreeBVSummary: async (userId) => {
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        const dates = getDateBoundaries();

        // Use separate aggregations because Mongoose reliably casts Dates inside `$match`, 
        // but often struggles inside `$cond` conditional bounds causing silent 0s.
        const calculateForLeg = async (legAffected) => {
            const sumByDate = async (startDate, endDate) => {
                const pipeline = [
                    {
                        $match: {
                            userId: user._id,
                            legAffected: legAffected,
                            createdAt: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$bvAmount' }
                        }
                    }
                ];
                const res = await BVTransaction.aggregate(pipeline);
                return res.length > 0 ? (res[0].total || 0) : 0;
            };

            const [currentMonth, halfYearly, annually] = await Promise.all([
                sumByDate(dates.currentMonth.start, dates.currentMonth.end),
                sumByDate(dates.halfYearly.start, dates.halfYearly.end),
                sumByDate(dates.annually.start, dates.annually.end)
            ]);

            return { currentMonth, halfYearly, annually };
        };

        const leftSummary = await calculateForLeg('left');
        const rightSummary = await calculateForLeg('right');


        return {
            user: {
                memberId: user.memberId,
                username: user.username,
                fullName: user.fullName
            },
            timeframes: {
                currentMonth: {
                    start: moment(dates.currentMonth.start).tz(TIMEZONE).format('YYYY-MM-DD'),
                    end: moment(dates.currentMonth.end).tz(TIMEZONE).format('YYYY-MM-DD')
                },
                halfYearly: {
                    start: moment(dates.halfYearly.start).tz(TIMEZONE).format('YYYY-MM-DD'),
                    end: moment(dates.halfYearly.end).tz(TIMEZONE).format('YYYY-MM-DD')
                },
                annually: {
                    start: moment(dates.annually.start).tz(TIMEZONE).format('YYYY-MM-DD'),
                    end: moment(dates.annually.end).tz(TIMEZONE).format('YYYY-MM-DD')
                }
            },
            bvSummary: {
                left: leftSummary,
                right: rightSummary
            }
        };
    }
};
