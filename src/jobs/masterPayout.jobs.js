import cron from 'node-cron';
import { generateDifferentialMasterPayouts } from '../services/business/masterPayout.service.js';

/**
 * Job: Master Franchise Differential & Override Payout Generator
 * Schedule: 00:05 AM on the 1st of every month
 * Description: Runs right after the primary franchise payouts are cleared. 
 * Reads the historical stats and calculates top-tier bonuses cleanly.
 */
// Export the cron job for mounting
export const masterFranchisePayoutCron = cron.schedule('5 0 1 * *', async () => {
    console.log('--------------------------------------------------');
    console.log('⚙️ [CRON JOB TRIGGERED: Master Franchise Payouts Engine]');
    console.log(`⏱️ Trigger Time: ${new Date().toISOString()}`);
    console.log('--------------------------------------------------');
    
    try {
        await generateDifferentialMasterPayouts();
    } catch (error) {
        console.error('❌ [CRON JOB FAILED: Master Franchise Payouts]', error);
    }
}, {
    timezone: "Asia/Kolkata",
    scheduled: true
});
