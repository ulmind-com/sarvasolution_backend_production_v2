import mongoose from 'mongoose';
import moment from 'moment-timezone';
import chalk from 'chalk';

import LeadershipBonusState from '../../models/LeadershipBonusState.model.js';
import LeadershipBonusPool from '../../models/LeadershipBonusPool.model.js';
import LeadershipBonusWalletCredit from '../../models/LeadershipBonusWalletCredit.model.js';
import UserFinance from '../../models/UserFinance.model.js';

const TIMEZONE = 'Asia/Kolkata';

// ── Constants — the ONLY things different from Start Up / Beginner Bonus ─────
const POOL_PERCENT     = 0.12;    // 12% of company BV  (was 18% in the others)
const BV_PER_UNIT      = 12000;   // 12,000 BV = 1 unit  (was 5000 / 1000)
// NO MAX_UNITS cap  ← unlimited
const ADMIN_CHARGE_PCT = 0.05;   // 5%
const TDS_PCT          = 0.02;   // 2%
const NET_PCT          = 0.93;   // 93% received by user

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const _getDescendantIds = async (User, startNodeId) => {
    if (!startNodeId) return [];
    const ids   = [];
    const queue = [startNodeId];
    while (queue.length > 0) {
        const currentId = queue.shift();
        ids.push(currentId);
        const u = await User.findById(currentId).select('leftChild rightChild').lean();
        if (u) {
            if (u.leftChild)  queue.push(u.leftChild);
            if (u.rightChild) queue.push(u.rightChild);
        }
    }
    return ids;
};

const _sumRepurchaseBV = async (SelfRepurchaseBVEntry, userIds, year, month) => {
    if (!userIds || userIds.length === 0) return 0;
    const entries = await SelfRepurchaseBVEntry.find({ userId: { $in: userIds }, year, month }).lean();
    return entries.reduce((acc, e) => acc + (e.bvAmount || 0), 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export const leadershipBonusService = {

    /**
     * Calculate a single user's Leadership unit count for a given year/month.
     * 12,000 BV = 1 unit. No capping.
     */
    calculateUserUnits: async (userId, year, month) => {
        const User = (await import('../../models/User.model.js')).default;
        const SelfRepurchaseBVEntry = (await import('../../models/SelfRepurchaseBVEntry.model.js')).default;

        const user = await User.findById(userId).select('leftChild rightChild memberId').lean();
        if (!user) return { leftBV: 0, rightBV: 0, personalBV: 0, adjustedLeft: 0, adjustedRight: 0, finalUnits: 0, weakerSide: null, carryLeft: 0, carryRight: 0 };

        // Step 1: Fresh leg BV
        const leftDesc  = await _getDescendantIds(User, user.leftChild);
        const rightDesc = await _getDescendantIds(User, user.rightChild);

        const freshLeft  = await _sumRepurchaseBV(SelfRepurchaseBVEntry, leftDesc,  year, month);
        const freshRight = await _sumRepurchaseBV(SelfRepurchaseBVEntry, rightDesc, year, month);

        // Step 2: Add carry-forward
        const state      = await LeadershipBonusState.findOne({ userId }).lean();
        const carryLeft  = state ? (state.carryForwardLeft  || 0) : 0;
        const carryRight = state ? (state.carryForwardRight || 0) : 0;

        const totalLeft  = freshLeft  + carryLeft;
        const totalRight = freshRight + carryRight;

        // Step 3: Add personal BV to weaker leg
        const personalEntries = await SelfRepurchaseBVEntry.find({ userId, year, month }).lean();
        const personalBV = personalEntries.reduce((acc, e) => acc + (e.bvAmount || 0), 0);

        let adjustedLeft  = totalLeft;
        let adjustedRight = totalRight;
        let weakerSide    = null;

        if (personalBV > 0) {
            if (totalLeft <= totalRight) {
                adjustedLeft = totalLeft + personalBV;
                weakerSide   = 'left';
            } else {
                adjustedRight = totalRight + personalBV;
                weakerSide    = 'right';
            }
        }

        // Step 4: Unit calculation — floor(weakerLeg / 12000), NO cap
        const matchedBV  = Math.min(adjustedLeft, adjustedRight);
        const finalUnits = Math.floor(matchedBV / BV_PER_UNIT);

        return { leftBV: totalLeft, rightBV: totalRight, personalBV, adjustedLeft, adjustedRight, finalUnits, weakerSide, carryLeft, carryRight };
    },

    /**
     * Month-end engine: compute all units, upsert pool, save carry-forwards, stage wallet credits.
     */
    runMonthEndDistribution: async (year, month) => {
        console.log(chalk.magenta(`[LeadershipBonus] Starting month-end distribution for ${year}-${month}...`));

        const existing = await LeadershipBonusPool.findOne({ year, month });
        if (existing && existing.status === 'distributed') {
            console.warn(chalk.yellow(`[LeadershipBonus] Already distributed for ${year}-${month}. Skipping.`));
            return existing;
        }

        const User                  = (await import('../../models/User.model.js')).default;
        const SelfRepurchaseBVEntry = (await import('../../models/SelfRepurchaseBVEntry.model.js')).default;

        // Company fresh BV
        const allEntries     = await SelfRepurchaseBVEntry.find({ year, month }).lean();
        const companyTotalBV = allEntries.reduce((acc, e) => acc + (e.bvAmount || 0), 0);
        console.log(chalk.cyan(`[LeadershipBonus] Company BV for ${year}-${month}: ${companyTotalBV}`));

        if (companyTotalBV === 0) {
            return LeadershipBonusPool.findOneAndUpdate(
                { year, month },
                { companyTotalBV: 0, poolAmount: 0, totalUnits: 0, status: 'held', notes: 'No company BV this month.' },
                { upsert: true, new: true }
            );
        }

        // All active users
        const allUsers = await User.find({ status: 'active', isFirstPurchaseDone: true })
            .select('_id memberId leftChild rightChild').lean();

        console.log(chalk.cyan(`[LeadershipBonus] Computing units for ${allUsers.length} users...`));

        const userResults = [];

        for (const u of allUsers) {
            const calc = await leadershipBonusService.calculateUserUnits(u._id, year, month);
            if (calc.finalUnits > 0) userResults.push({ user: u, calc });

            // Save carry-forward
            const strongerBV     = Math.max(calc.adjustedLeft, calc.adjustedRight);
            const weakerBV       = Math.min(calc.adjustedLeft, calc.adjustedRight);
            const leftIsStronger = calc.adjustedLeft >= calc.adjustedRight;

            await LeadershipBonusState.findOneAndUpdate(
                { userId: u._id },
                {
                    userId:              u._id,
                    memberId:            u.memberId,
                    carryForwardLeft:    leftIsStronger ? (strongerBV - weakerBV) : 0,
                    carryForwardRight:   leftIsStronger ? 0 : (strongerBV - weakerBV),
                    lastProcessedYear:   year,
                    lastProcessedMonth:  month
                },
                { upsert: true }
            );
        }

        // Build pool
        const poolAmount      = companyTotalBV * POOL_PERCENT;
        const totalUnits      = userResults.reduce((acc, r) => acc + r.calc.finalUnits, 0);
        const perUnitValue    = totalUnits > 0 ? poolAmount / totalUnits : 0;
        const eligibleUserIds = userResults.map(r => r.user._id);

        let pool;
        if (existing) {
            existing.companyTotalBV    = companyTotalBV;
            existing.poolAmount        = poolAmount;
            existing.totalUnits        = totalUnits;
            existing.perUnitValue      = perUnitValue;
            existing.eligibleUserCount = userResults.length;
            existing.eligibleUserIds   = eligibleUserIds;
            existing.status            = userResults.length > 0 ? 'pending' : 'held';
            pool = await existing.save();
        } else {
            pool = await LeadershipBonusPool.create({
                year, month, companyTotalBV, poolAmount, totalUnits, perUnitValue,
                eligibleUserCount: userResults.length,
                eligibleUserIds,
                status: userResults.length > 0 ? 'pending' : 'held'
            });
        }

        if (userResults.length === 0) {
            console.warn(chalk.yellow(`[LeadershipBonus] No eligible users for ${year}-${month}.`));
            return pool;
        }

        // Stage wallet credits
        for (const { user, calc } of userResults) {
            const grossCredit = perUnitValue * calc.finalUnits;
            const adminCharge = grossCredit * ADMIN_CHARGE_PCT;
            const tds         = grossCredit * TDS_PCT;
            const netCredit   = grossCredit * NET_PCT;

            await LeadershipBonusWalletCredit.findOneAndUpdate(
                { userId: user._id, year, month },
                {
                    userId:       user._id,
                    memberId:     user.memberId,
                    year, month,
                    leftLegBV:    calc.leftBV,
                    rightLegBV:   calc.rightBV,
                    personalBV:   calc.personalBV,
                    adjustedLeft:  calc.adjustedLeft,
                    adjustedRight: calc.adjustedRight,
                    finalUnits:   calc.finalUnits,
                    poolId:       pool._id,
                    perUnitValue,
                    grossCredit,
                    adminCharge,
                    tds,
                    netCredit,
                    creditedAt: null
                },
                { upsert: true }
            );
        }

        console.log(chalk.green(
            `[LeadershipBonus] Staged for ${year}-${month}. ${userResults.length} users, ${totalUnits} units, pool ₹${poolAmount.toFixed(2)}.`
        ));
        return pool;
    },

    /**
     * Apply pending wallet credits (called 1st of month 00:10 IST).
     */
    applyWalletCredits: async (year, month) => {
        console.log(chalk.magenta(`[LeadershipBonus] Applying wallet credits for ${year}-${month}...`));

        const pool = await LeadershipBonusPool.findOne({ year, month });
        if (!pool || pool.status !== 'pending') {
            console.warn(chalk.yellow(`[LeadershipBonus] No pending pool for ${year}-${month}. Skipping.`));
            return;
        }

        const credits    = await LeadershipBonusWalletCredit.find({ year, month, creditedAt: null });
        const creditedAt = moment().tz(TIMEZONE).toDate();

        for (const credit of credits) {
            await UserFinance.findOneAndUpdate(
                { user: credit.userId },
                { $inc: { 'wallet.totalEarnings': credit.netCredit, 'wallet.availableBalance': credit.netCredit } }
            );
            credit.creditedAt = creditedAt;
            await credit.save();
            console.log(chalk.green(`[LeadershipBonus] Credited ₹${credit.netCredit.toFixed(2)} to ${credit.memberId}`));
        }

        pool.status        = 'distributed';
        pool.distributedAt = creditedAt;
        await pool.save();
        console.log(chalk.green(`[LeadershipBonus] ✅ All credits applied for ${year}-${month}.`));
    },

    // ─────────────────────────────────────────────────────────────────────────
    // USER-FACING QUERIES
    // ─────────────────────────────────────────────────────────────────────────

    getUserStatus: async (userId) => {
        const now   = moment().tz(TIMEZONE);
        const year  = now.year();
        const month = now.month() + 1;
        const calc  = await leadershipBonusService.calculateUserUnits(userId, year, month);
        const state = await LeadershipBonusState.findOne({ userId }).lean();

        return {
            currentMonth: { year, month },
            carryForward: {
                left:  state ? (state.carryForwardLeft  || 0) : 0,
                right: state ? (state.carryForwardRight || 0) : 0
            },
            bvBreakdown: {
                freshLeftBV:   calc.leftBV  - (state ? (state.carryForwardLeft  || 0) : 0),
                freshRightBV:  calc.rightBV - (state ? (state.carryForwardRight || 0) : 0),
                carryLeftBV:   state ? (state.carryForwardLeft  || 0) : 0,
                carryRightBV:  state ? (state.carryForwardRight || 0) : 0,
                totalLeftBV:   calc.leftBV,
                totalRightBV:  calc.rightBV,
                personalBV:    calc.personalBV,
                adjustedLeft:  calc.adjustedLeft,
                adjustedRight: calc.adjustedRight,
                weakerSide:    calc.weakerSide
            },
            units: {
                estimated:  calc.finalUnits,
                bvPerUnit:  BV_PER_UNIT,
                noCapping:  true
            }
        };
    },

    getUserHistory: async (userId) =>
        LeadershipBonusWalletCredit.find({ userId }).sort({ year: -1, month: -1 }).lean(),

    // ─────────────────────────────────────────────────────────────────────────
    // LIVE POOL PREVIEW (read-only)
    // ─────────────────────────────────────────────────────────────────────────

    getLivePool: async () => {
        const User                  = (await import('../../models/User.model.js')).default;
        const SelfRepurchaseBVEntry = (await import('../../models/SelfRepurchaseBVEntry.model.js')).default;

        const now   = moment().tz(TIMEZONE);
        const year  = now.year();
        const month = now.month() + 1;

        const allEntries     = await SelfRepurchaseBVEntry.find({ year, month }).lean();
        const companyTotalBV = allEntries.reduce((acc, e) => acc + (e.bvAmount || 0), 0);
        const poolAmount     = companyTotalBV * POOL_PERCENT;

        const allUsers = await User.find({ status: 'active', isFirstPurchaseDone: true })
            .select('_id memberId fullName').lean();

        const userResults = [];
        for (const u of allUsers) {
            const calc = await leadershipBonusService.calculateUserUnits(u._id, year, month);
            if (calc.finalUnits > 0) userResults.push({ user: u, calc });
        }

        const totalUnits   = userResults.reduce((acc, r) => acc + r.calc.finalUnits, 0);
        const perUnitValue = totalUnits > 0 ? poolAmount / totalUnits : 0;

        const userBreakdown = userResults.map(({ user, calc }) => {
            const grossCredit       = perUnitValue * calc.finalUnits;
            const netCredit         = grossCredit * NET_PCT;
            const adjustedWeakerLeg = Math.min(calc.adjustedLeft, calc.adjustedRight);
            return {
                memberId:           user.memberId,
                fullName:           user.fullName,
                leftBV:             calc.leftBV,
                rightBV:            calc.rightBV,
                personalBV:         calc.personalBV,
                adjustedLeft:       calc.adjustedLeft,
                adjustedRight:      calc.adjustedRight,
                weakerSide:         calc.weakerSide,
                adjustedWeakerLeg,
                finalUnits:         calc.finalUnits,
                estimatedGross:     parseFloat(grossCredit.toFixed(2)),
                estimatedNet:       parseFloat(netCredit.toFixed(2))
            };
        });

        userBreakdown.sort((a, b) => b.estimatedNet - a.estimatedNet);

        return {
            currentMonth: { year, month },
            pool: {
                companyTotalBV,
                poolPercent:      POOL_PERCENT * 100,
                poolAmount:       parseFloat(poolAmount.toFixed(2)),
                totalUnits,
                perUnitValue:     parseFloat(perUnitValue.toFixed(4)),
                eligibleUserCount: userResults.length
            },
            users: userBreakdown
        };
    },

    getUserLiveEstimate: async (userId) => {
        const SelfRepurchaseBVEntry = (await import('../../models/SelfRepurchaseBVEntry.model.js')).default;
        const User                  = (await import('../../models/User.model.js')).default;

        const now   = moment().tz(TIMEZONE);
        const year  = now.year();
        const month = now.month() + 1;

        const allEntries     = await SelfRepurchaseBVEntry.find({ year, month }).lean();
        const companyTotalBV = allEntries.reduce((acc, e) => acc + (e.bvAmount || 0), 0);
        const poolAmount     = companyTotalBV * POOL_PERCENT;

        const allUsers = await User.find({ status: 'active', isFirstPurchaseDone: true })
            .select('_id').lean();

        let totalUnits = 0;
        let myCalc     = null;

        for (const u of allUsers) {
            const calc = await leadershipBonusService.calculateUserUnits(u._id, year, month);
            totalUnits += calc.finalUnits;
            if (u._id.toString() === userId.toString()) myCalc = calc;
        }
        if (!myCalc) myCalc = await leadershipBonusService.calculateUserUnits(userId, year, month);

        const perUnitValue = totalUnits > 0 ? poolAmount / totalUnits : 0;
        const grossCredit  = perUnitValue * myCalc.finalUnits;
        const netCredit    = grossCredit * NET_PCT;

        return {
            currentMonth: { year, month },
            companyBV: {
                totalBV:     companyTotalBV,
                poolPercent: POOL_PERCENT * 100,
                poolAmount:  parseFloat(poolAmount.toFixed(2))
            },
            pool: {
                totalUnits,
                perUnitValue:  parseFloat(perUnitValue.toFixed(4)),
                eligibleUsers: allUsers.length
            },
            myEstimate: {
                myUnits:       myCalc.finalUnits,
                bvPerUnit:     BV_PER_UNIT,
                noCapping:     true,
                grossEarning:  parseFloat(grossCredit.toFixed(2)),
                deduction7pct: parseFloat((grossCredit * (1 - NET_PCT)).toFixed(2)),
                netEarning:    parseFloat(netCredit.toFixed(2))
            }
        };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN QUERIES
    // ─────────────────────────────────────────────────────────────────────────

    getAdminPoolList: async (page = 1, limit = 12) => {
        const skip = (page - 1) * limit;
        const [pools, total] = await Promise.all([
            LeadershipBonusPool.find().sort({ year: -1, month: -1 }).skip(skip).limit(limit).lean(),
            LeadershipBonusPool.countDocuments()
        ]);
        return { pools, total, page, limit };
    },

    getAdminPoolDetails: async (year, month) => {
        const pool = await LeadershipBonusPool.findOne({ year, month }).lean();
        if (!pool) return null;
        const credits = await LeadershipBonusWalletCredit.find({ year, month })
            .sort({ finalUnits: -1 }).lean();
        return { pool, credits };
    },

    getAdminUserDetails: async (memberId) => {
        const User = (await import('../../models/User.model.js')).default;
        const user = await User.findOne({ memberId }).select('_id memberId fullName status').lean();
        if (!user) return null;

        const [credits, state] = await Promise.all([
            LeadershipBonusWalletCredit.find({ userId: user._id }).sort({ year: -1, month: -1 }).lean(),
            LeadershipBonusState.findOne({ userId: user._id }).lean()
        ]);

        const currentMonthCalc = await leadershipBonusService.calculateUserUnits(
            user._id,
            moment().tz(TIMEZONE).year(),
            moment().tz(TIMEZONE).month() + 1
        );

        return { user, credits, state, currentMonth: currentMonthCalc };
    },

    getAdminCurrentMonthOverview: async () => {
        const User  = (await import('../../models/User.model.js')).default;
        const now   = moment().tz(TIMEZONE);
        const year  = now.year();
        const month = now.month() + 1;

        const allUsers = await User.find({ status: 'active', isFirstPurchaseDone: true })
            .select('_id memberId fullName').lean();

        const results = [];
        for (const u of allUsers) {
            const calc = await leadershipBonusService.calculateUserUnits(u._id, year, month);
            results.push({
                memberId:          u.memberId,
                fullName:          u.fullName,
                leftBV:            calc.leftBV,
                rightBV:           calc.rightBV,
                personalBV:        calc.personalBV,
                adjustedLeft:      calc.adjustedLeft,
                adjustedRight:     calc.adjustedRight,
                weakerSide:        calc.weakerSide,
                adjustedWeakerLeg: Math.min(calc.adjustedLeft, calc.adjustedRight),
                estimatedUnits:    calc.finalUnits
            });
        }

        results.sort((a, b) => b.estimatedUnits - a.estimatedUnits);
        return { year, month, users: results };
    }
};
