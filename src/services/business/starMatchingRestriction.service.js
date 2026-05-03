import Payout from '../../models/Payout.model.js';

/**
 * Star Matching Restriction Service (Isolated)
 * 
 * Business Rule: The 6th, 7th, 8th, 9th, and 10th Star Matching events
 * are restricted (no payout). All other events (1-5 and 11+) are normal.
 * 
 * This service queries existing Payout records to determine the count.
 * No new fields are added to any model.
 */
export const starMatchingRestrictionService = {

    /**
     * Check if the next star matching event is restricted.
     * @param {ObjectId} userId - The user's ObjectId
     * @returns {{ isRestricted: boolean, nextCount: number }}
     */
    check: async (userId) => {
        // Count ALL star matching events (bonus + flashout) for this user
        const totalCount = await Payout.countDocuments({
            userId: userId,
            payoutType: { $in: ['star-matching-bonus', 'star-matching-flashout'] }
        });

        // The NEXT event will be count + 1
        const nextCount = totalCount + 1;

        // Restricted: only positions 6, 7, 8, 9, 10
        const isRestricted = nextCount >= 6 && nextCount <= 10;

        return { isRestricted, nextCount };
    }
};
