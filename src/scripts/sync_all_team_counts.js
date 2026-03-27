import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb+srv://sarvasolutionvision_db_user:sarva1974%40@cluster0.jdrxvhw.mongodb.net/sarvasolution_t_main_db';

const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', userSchema);

async function syncAllTeamCounts(isDryRun = false) {
    console.log(`\n=== Starting UNIVERSAL TEAM COUNT SYNC ===`);
    console.log(`Mode: ${isDryRun ? 'DRY RUN (No changes will be saved)' : 'PRODUCTION WRITE (Saving to DB)'}`);
    
    try {
        await mongoose.connect(URI, { serverSelectionTimeoutMS: 20000 });
        console.log('Connected to MongoDB.\n');

        // 1. Fetch all users
        const allUsers = await User.find({}, {
            _id: 1, memberId: 1, status: 1,
            leftChild: 1, rightChild: 1,
            leftTeamActive: 1, leftTeamInactive: 1, leftTeamCount: 1,
            rightTeamActive: 1, rightTeamInactive: 1, rightTeamCount: 1
        }).lean();

        console.log(`Fetched ${allUsers.length} users from database.`);
        const userMap = {};
        allUsers.forEach(u => userMap[u._id.toString()] = u);

        const bulkOperations = [];
        let differencesFound = 0;

        // 2. Compute absolute truth for each user
        for (const user of allUsers) {
            const computeLeg = (startNodeId) => {
                let total = 0;
                let active = 0;
                let inactive = 0;
                
                if (!startNodeId) return { total, active, inactive };
                
                const queue = [startNodeId.toString()];
                while (queue.length > 0) {
                    const id = queue.shift();
                    const current = userMap[id];
                    if (current) {
                        total++;
                        if (current.status === 'active') active++;
                        else inactive++;
                        
                        if (current.leftChild) queue.push(current.leftChild.toString());
                        if (current.rightChild) queue.push(current.rightChild.toString());
                    }
                }
                return { total, active, inactive };
            };

            const leftTruth = computeLeg(user.leftChild);
            const rightTruth = computeLeg(user.rightChild);

            // Compare truth with stored
            const mismatch = 
                leftTruth.total !== (user.leftTeamCount || 0) ||
                leftTruth.active !== (user.leftTeamActive || 0) ||
                leftTruth.inactive !== (user.leftTeamInactive || 0) ||
                rightTruth.total !== (user.rightTeamCount || 0) ||
                rightTruth.active !== (user.rightTeamActive || 0) ||
                rightTruth.inactive !== (user.rightTeamInactive || 0);

            if (mismatch) {
                differencesFound++;
                if (user.memberId === 'SVS23286132' || user.memberId === 'SVS24216680') {
                    console.log(`\n[FIXING] Highlighted User: ${user.memberId}`);
                    console.log(`   LEFT  => Total: ${user.leftTeamCount} -> ${leftTruth.total} | Active: ${user.leftTeamActive} -> ${leftTruth.active} | Inactive: ${user.leftTeamInactive} -> ${leftTruth.inactive}`);
                    console.log(`   RIGHT => Total: ${user.rightTeamCount} -> ${rightTruth.total} | Active: ${user.rightTeamActive} -> ${rightTruth.active} | Inactive: ${user.rightTeamInactive} -> ${rightTruth.inactive}`);
                }

                bulkOperations.push({
                    updateOne: {
                        filter: { _id: user._id },
                        update: {
                            $set: {
                                leftTeamCount: leftTruth.total,
                                leftTeamActive: leftTruth.active,
                                leftTeamInactive: leftTruth.inactive,
                                rightTeamCount: rightTruth.total,
                                rightTeamActive: rightTruth.active,
                                rightTeamInactive: rightTruth.inactive
                            }
                        }
                    }
                });
            }
        }

        console.log(`\nCompleted computational phase. Found ${differencesFound} users with mismatched data.`);

        if (bulkOperations.length === 0) {
            console.log('Database is already perfectly synchronized! Nothing to update.');
        } else {
            console.log(`Ready to update ${bulkOperations.length} records.`);
            if (!isDryRun) {
                console.log('Executing Bulk Write to Production Database...');
                const result = await User.bulkWrite(bulkOperations);
                console.log(`SUCCESS! Modified ${result.modifiedCount} records.`);
            } else {
                console.log('--dry-run mode: Skipping bulkWrite. Run without args to save.');
            }
        }

        process.exit(0);

    } catch (e) {
        console.error('\nFATAL ERROR:', e);
        process.exit(1);
    }
}

const isDryRun = process.argv.includes('--dry-run');
syncAllTeamCounts(isDryRun);
