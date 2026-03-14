import mongoose from 'mongoose';
import moment from 'moment-timezone';
import chalk from 'chalk';

import SelfRepurchaseBVEntry from '../../models/SelfRepurchaseBVEntry.model.js';
import SelfRepurchaseBonusPool from '../../models/SelfRepurchaseBonusPool.model.js';
import SelfRepurchaseWalletCredit from '../../models/SelfRepurchaseWalletCredit.model.js';
import UserFinance from '../../models/UserFinance.model.js';
import Payout from '../../models/Payout.model.js';

const TIMEZONE = 'Asia/Kolkata';

// Business constants — stored here for single-source-of-truth
const POOL_PERCENT = 0.07;       // 7% of company BV
const ADMIN_CHARGE_PCT = 0.05;   // 5%
const TDS_PCT = 0.02;            // 2%
const DEDUCTION_PCT = 0.07;      // 5 + 2 = 7%
const NET_PCT = 0.93;            // What users actually receive
const ELIGIBILITY_WINDOW_DAY = 10; // Day 1–10 of month (IST)
const ELIGIBILITY_MIN_BV = 500;  // Minimum BV in the window to qualify

/**
 * Self Repurchase Bonus Service
 * -------------------------------------------------------
 * ALL methods are non-throwing at the top level when called from the
 * sale controller hook — errors are logged but never bubble up to
 * disrupt the existing sale flow.
 */
export const selfRepurchaseService = {

    /**
     * Record a repurchase BV entry for a user.
     * Called from sale.controller.js after non-first-purchase BV is credited.
     *
     * @param {ObjectId|string} userId
     * @param {string} memberId
     * @param {number} bvAmount
     * @param {string} saleId - FranchiseSale.saleNo
     */
    recordRepurchaseBV: async (userId, memberId, bvAmount, saleId) => {
        try {
            if (!bvAmount || bvAmount <= 0) return;

            const now = moment().tz(TIMEZONE);
            const dayOfMonth = now.date(); // 1–31
            const month = now.month() + 1; // 1–12
            const year = now.year();

            const isInEligibilityWindow = dayOfMonth >= 1 && dayOfMonth <= ELIGIBILITY_WINDOW_DAY;

            // upsert=false: we want it to fail if saleId already exists (unique index)
            // In practice this won't happen, but if it does, the catch below handles it gracefully.
            await SelfRepurchaseBVEntry.create({
                userId,
                memberId,
                saleId,
                bvAmount,
                purchaseDate: now.toDate(),
                month,
                year,
                isInEligibilityWindow
            });

            console.log(chalk.cyan(
                `[SRB] BV recorded: userId=${memberId} bv=${bvAmount} window=${isInEligibilityWindow} month=${year}-${month}`
            ));
        } catch (err) {
            // Duplicate saleId (already recorded) is safe to ignore.
            if (err.code === 11000) {
                console.warn(`[SRB] Duplicate saleId skipped: ${saleId}`);
                return;
            }
            console.error('[SRB] recordRepurchaseBV error:', err.message);
        }
    },

    /**
     * Get total company-wide BV for a given calendar month.
     * Sums ALL BV entries (all users, all days in the month).
     *
     * @param {number} year
     * @param {number} month  (1-indexed)
     * @returns {Promise<number>}
     */
    getMonthlyCompanyBV: async (year, month) => {
        const result = await SelfRepurchaseBVEntry.aggregate([
            { $match: { year, month } },
            { $group: { _id: null, totalBV: { $sum: '$bvAmount' } } }
        ]);
        return result.length > 0 ? result[0].totalBV : 0;
    },

    /**
     * Find users who accumulated ≥500 BV in the 1–10 eligibility window
     * for a given calendar month.
     *
     * @param {number} year
     * @param {number} month  (1-indexed)
     * @returns {Promise<Array<{ userId: ObjectId, memberId: string, windowBV: number }>>}
     */
    computeEligibleUsers: async (year, month) => {
        const result = await SelfRepurchaseBVEntry.aggregate([
            {
                $match: {
                    year,
                    month,
                    isInEligibilityWindow: true
                }
            },
            {
                $group: {
                    _id: '$userId',
                    memberId: { $first: '$memberId' },
                    windowBV: { $sum: '$bvAmount' }
                }
            },
            {
                $match: { windowBV: { $gte: ELIGIBILITY_MIN_BV } }
            }
        ]);

        return result.map(r => ({
            userId: r._id,
            memberId: r.memberId,
            windowBV: r.windowBV
        }));
    },

    /**
     * Month-end distribution job.
     * - Idempotent: safe to call multiple times; will skip if already distributed.
     * - Calculates pool, finds eligible users, credits wallets.
     * - If no eligible users → status: 'held'.
     *
     * @param {number} year
     * @param {number} month  (1-indexed)
     * @returns {Promise<{ status: string, poolAmount: number, creditsIssued: number }>}
     */
    runMonthEndDistribution: async (year, month) => {
        console.log(chalk.magenta(`\n[SRB] Starting month-end distribution for ${year}-${String(month).padStart(2, '0')}...`));

        // --- Guard: prevent double run ---
        const existingPool = await SelfRepurchaseBonusPool.findOne({ year, month });
        if (existingPool && existingPool.status !== 'pending') {
            console.log(chalk.yellow(`[SRB] Already processed (status: ${existingPool.status}). Skipping.`));
            return { status: existingPool.status, poolAmount: existingPool.poolAmount, creditsIssued: existingPool.eligibleUserCount };
        }

        // --- 1. Compute company total BV ---
        const companyTotalBV = await selfRepurchaseService.getMonthlyCompanyBV(year, month);
        const poolAmount = parseFloat((companyTotalBV * POOL_PERCENT).toFixed(2));

        console.log(chalk.cyan(`[SRB] Company Total BV: ${companyTotalBV} | Pool (7%): ₹${poolAmount}`));

        // --- 2. Find eligible users ---
        const eligibleUsers = await selfRepurchaseService.computeEligibleUsers(year, month);
        const eligibleCount = eligibleUsers.length;

        console.log(chalk.cyan(`[SRB] Eligible users: ${eligibleCount}`));

        // --- 3. Create or update pool record ---
        const poolData = {
            companyTotalBV,
            poolAmount,
            eligibleUserCount: eligibleCount,
            eligibleUserIds: eligibleUsers.map(u => u.userId)
        };

        // If no eligible users — hold the pool
        if (eligibleCount === 0 || poolAmount === 0) {
            const pool = await SelfRepurchaseBonusPool.findOneAndUpdate(
                { year, month },
                {
                    $set: {
                        ...poolData,
                        grossSharePerUser: 0,
                        netSharePerUser: 0,
                        status: 'held',
                        notes: poolAmount === 0
                            ? 'No company BV recorded for this month.'
                            : 'No eligible users (minimum 500 BV in 1–10 window not met). Pool held.',
                        distributedAt: new Date()
                    }
                },
                { upsert: true, new: true }
            );

            console.log(chalk.yellow('[SRB] Pool held — no eligible users or zero BV.'));
            return { status: 'held', poolAmount, creditsIssued: 0, poolId: pool._id };
        }

        // --- 4. Calculate per-user shares ---
        const grossShare = parseFloat((poolAmount / eligibleCount).toFixed(2));
        const adminCharge = parseFloat((grossShare * ADMIN_CHARGE_PCT).toFixed(2));
        const tdsDeducted = parseFloat((grossShare * TDS_PCT).toFixed(2));
        const totalDeduction = parseFloat((grossShare * DEDUCTION_PCT).toFixed(2));
        const netShare = parseFloat((grossShare * NET_PCT).toFixed(2));

        console.log(chalk.cyan(
            `[SRB] Per user — Gross: ₹${grossShare} | Admin (5%): ₹${adminCharge} | TDS (2%): ₹${tdsDeducted} | Net (93%): ₹${netShare}`
        ));

        // --- 5. Save pool record ---
        const pool = await SelfRepurchaseBonusPool.findOneAndUpdate(
            { year, month },
            {
                $set: {
                    ...poolData,
                    grossSharePerUser: grossShare,
                    adminChargePercent: 5,
                    tdsPercent: 2,
                    totalDeductionPct: 7,
                    netSharePerUser: netShare,
                    status: 'distributed',
                    distributedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        // --- 6. Credit each eligible user's wallet ---
        let creditsIssued = 0;
        const errors = [];

        for (const eligible of eligibleUsers) {
            try {
                // Prevent double-credit via unique index on {userId, year, month}
                // Check first to avoid write errors on partial re-runs
                const alreadyCredited = await SelfRepurchaseWalletCredit.findOne({
                    userId: eligible.userId, year, month
                });
                if (alreadyCredited) {
                    console.warn(`[SRB] Skip double-credit for ${eligible.memberId}`);
                    continue;
                }

                const creditedAt = new Date();

                // a) Credit wallet in UserFinance
                await UserFinance.findOneAndUpdate(
                    { user: eligible.userId },
                    {
                        $inc: {
                            'wallet.availableBalance': netShare,
                            'wallet.totalEarnings': netShare
                        }
                    }
                );

                // b) Create the immutable audit log
                await SelfRepurchaseWalletCredit.create({
                    userId: eligible.userId,
                    memberId: eligible.memberId,
                    poolId: pool._id,
                    year,
                    month,
                    grossAmount: grossShare,
                    adminCharge,
                    tdsDeducted,
                    totalDeduction,
                    netAmount: netShare,
                    creditedAt
                });

                // c) Create Payout record (labeled 'self-repurchase-bonus')
                await Payout.create({
                    userId: eligible.userId,
                    memberId: eligible.memberId,
                    payoutType: 'self-repurchase-bonus',
                    grossAmount: grossShare,
                    adminCharge,
                    tdsDeducted: tdsDeducted,
                    netAmount: netShare,
                    status: 'completed',
                    processedAt: creditedAt,
                    scheduledFor: creditedAt,
                    metadata: {
                        bvMatched: eligible.windowBV
                    }
                });

                creditsIssued++;
                console.log(chalk.green(`[SRB] ✓ Credited ₹${netShare} (net) to ${eligible.memberId}`));
            } catch (err) {
                errors.push({ memberId: eligible.memberId, error: err.message });
                console.error(chalk.red(`[SRB] ✗ Failed credit for ${eligible.memberId}:`), err.message);
            }
        }

        // --- 7. Summary ---
        console.log(chalk.magenta('========== SRB DISTRIBUTION SUMMARY =========='));
        console.log(chalk.cyan(`Month: ${year}-${String(month).padStart(2, '0')}`));
        console.log(chalk.cyan(`Company BV: ${companyTotalBV} | Pool: ₹${poolAmount}`));
        console.log(chalk.green(`Credits issued: ${creditsIssued} / ${eligibleCount}`));
        if (errors.length > 0) {
            console.log(chalk.red(`Errors: ${errors.length}`));
            errors.forEach(e => console.log(chalk.red(`  - ${e.memberId}: ${e.error}`)));
        }
        console.log(chalk.magenta('===============================================\n'));

        return { status: 'distributed', poolAmount, creditsIssued, poolId: pool._id };
    },

    /**
     * Get a user's Self Repurchase Bonus status for the current month.
     * Used by the user-facing API endpoint.
     *
     * @param {ObjectId|string} userId
     * @returns {Promise<Object>}
     */
    getUserSRBStatus: async (userId) => {
        const now = moment().tz(TIMEZONE);
        const year = now.year();
        const month = now.month() + 1;

        // Current month: total window BV for this user
        const windowAgg = await SelfRepurchaseBVEntry.aggregate([
            {
                $match: {
                    userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
                    year,
                    month,
                    isInEligibilityWindow: true
                }
            },
            { $group: { _id: null, totalWindowBV: { $sum: '$bvAmount' } } }
        ]);

        const currentMonthWindowBV = windowAgg.length > 0 ? windowAgg[0].totalWindowBV : 0;
        const isEligibleCurrentMonth = currentMonthWindowBV >= ELIGIBILITY_MIN_BV;

        // Window closes on the 10th of the current month at 23:59:59 IST
        const windowClosesMoment = now.clone().date(ELIGIBILITY_WINDOW_DAY).endOf('day');
        const windowAlreadyClosed = now.isAfter(windowClosesMoment);

        // Last month: check if a credit was issued
        const lastMonthMoment = now.clone().subtract(1, 'month');
        const lastMonthYear = lastMonthMoment.year();
        const lastMonthNum = lastMonthMoment.month() + 1;

        const lastMonthCredit = await SelfRepurchaseWalletCredit.findOne({
            userId,
            year: lastMonthYear,
            month: lastMonthNum
        }).lean();

        return {
            currentMonth: {
                year,
                month,
                windowBV: currentMonthWindowBV,
                isEligible: isEligibleCurrentMonth,
                bvNeededForEligibility: Math.max(0, ELIGIBILITY_MIN_BV - currentMonthWindowBV),
                eligibilityWindowDay: ELIGIBILITY_WINDOW_DAY,
                windowClosed: windowAlreadyClosed,
                windowClosesAt: windowClosesMoment.format('YYYY-MM-DD HH:mm:ss')
            },
            lastMonth: {
                year: lastMonthYear,
                month: lastMonthNum,
                bonusReceived: !!lastMonthCredit,
                grossAmount: lastMonthCredit?.grossAmount ?? 0,
                netAmount: lastMonthCredit?.netAmount ?? 0,
                adminCharge: lastMonthCredit?.adminCharge ?? 0,
                tdsDeducted: lastMonthCredit?.tdsDeducted ?? 0,
                creditedAt: lastMonthCredit?.creditedAt ?? null
            }
        };
    },

    /**
     * Get Company Total BV for a specific month (admin view).
     *
     * @param {number} year
     * @param {number} month  (1-indexed)
     * @returns {Promise<Object>}
     */
    getCompanyBVForMonth: async (year, month) => {
        const [companyTotalBV, entryCount] = await Promise.all([
            selfRepurchaseService.getMonthlyCompanyBV(year, month),
            SelfRepurchaseBVEntry.countDocuments({ year, month })
        ]);

        return {
            year,
            month,
            companyTotalBV,
            totalTransactions: entryCount,
            projectedPool: parseFloat((companyTotalBV * POOL_PERCENT).toFixed(2)),
            poolPercent: POOL_PERCENT * 100
        };
    },

    /**
     * Get distribution details for a specific month (admin view).
     *
     * @param {number} year
     * @param {number} month  (1-indexed)
     * @returns {Promise<Object|null>}
     */
    getDistributionDetails: async (year, month) => {
        const pool = await SelfRepurchaseBonusPool.findOne({ year, month }).lean();
        if (!pool) return null;

        const credits = await SelfRepurchaseWalletCredit.find({ poolId: pool._id })
            .select('memberId grossAmount netAmount adminCharge tdsDeducted creditedAt')
            .lean();

        return { pool, credits };
    }
};
