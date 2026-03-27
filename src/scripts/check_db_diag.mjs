import mongoose from 'mongoose';

const URI = 'mongodb+srv://sarvasolutionvision_db_user:sarva1974%40@cluster0.jdrxvhw.mongodb.net/sarvasolution_t_main_db';

const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', userSchema);

async function start() {
    try {
        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(URI, { serverSelectionTimeoutMS: 20000 });
        console.log('Connected!\n');

        const memberId = 'SVS23286132';
        const user = await User.findOne({ memberId }, {
            _id: 1, memberId: 1, status: 1,
            leftChild: 1, rightChild: 1,
            activeLeft: 1, activeRight: 1,
            totalLeft: 1, totalRight: 1,
            isFirstPurchaseDone: 1
        }).lean();

        if (!user) {
            console.log(`User ${memberId} not found.`);
            process.exit(1);
        }

        console.log('==== STORED VALUES ====');
        console.log('User ID:              ', user._id.toString());
        console.log('Status:               ', user.status);
        console.log('isFirstPurchaseDone:  ', user.isFirstPurchaseDone);
        console.log('Stored activeLeft:    ', user.activeLeft);
        console.log('Stored activeRight:   ', user.activeRight);
        console.log('Stored totalLeft:     ', user.totalLeft);
        console.log('Stored totalRight:    ', user.totalRight);

        // Use $graphLookup to do the ENTIRE tree traversal in one query
        // connectFromField: "_id", connectToField: "parent" -- but this system uses leftChild/rightChild pointers
        // Unfortunately graphLookup on sibling-pointer trees doesn't work well
        // So let's get ALL users at once and build the tree in-memory

        console.log('\nFetching all users from DB (single query)...');
        const allUsers = await User.find({}, {
            _id: 1, memberId: 1, status: 1,
            leftChild: 1, rightChild: 1,
            isFirstPurchaseDone: 1
        }).lean();
        console.log(`Total users in DB: ${allUsers.length}`);

        // Build a lookup map
        const userMap = {};
        for (const u of allUsers) {
            userMap[u._id.toString()] = u;
        }

        // Breadth-first traversal of RIGHT leg
        let totalRightActual = 0;
        let activeRightActual = 0;
        let inactiveRightActual = 0;
        let rightLegUsers = [];

        if (user.rightChild) {
            const queue = [user.rightChild.toString()];
            while (queue.length > 0) {
                const currentId = queue.shift();
                const current = userMap[currentId];
                if (current) {
                    totalRightActual++;
                    const isActive = current.status === 'active';
                    if (isActive) activeRightActual++;
                    else inactiveRightActual++;
                    rightLegUsers.push(current);
                    if (current.leftChild)  queue.push(current.leftChild.toString());
                    if (current.rightChild) queue.push(current.rightChild.toString());
                } else {
                    console.log(`WARNING: Orphan pointer — node ${currentId} referenced but NOT found in DB!`);
                }
            }
        }

        // Breadth-first traversal of LEFT leg
        let totalLeftActual = 0;
        let activeLeftActual = 0;
        let inactiveLeftActual = 0;

        if (user.leftChild) {
            const queue = [user.leftChild.toString()];
            while (queue.length > 0) {
                const currentId = queue.shift();
                const current = userMap[currentId];
                if (current) {
                    totalLeftActual++;
                    const isActive = current.status === 'active';
                    if (isActive) activeLeftActual++;
                    else inactiveLeftActual++;
                    if (current.leftChild)  queue.push(current.leftChild.toString());
                    if (current.rightChild) queue.push(current.rightChild.toString());
                } else {
                    console.log(`WARNING: Orphan pointer — node ${currentId} referenced but NOT found in DB!`);
                }
            }
        }

        console.log('\n==== ACTUAL TRAVERSAL COUNTS ====');
        console.log(`Total Right (actual):   ${totalRightActual}  | Stored: ${user.totalRight ?? 'N/A'}`);
        console.log(`Active Right (actual):  ${activeRightActual} | Stored: ${user.activeRight ?? 'N/A'}`);
        console.log(`Inactive Right (actual):${inactiveRightActual}`);
        console.log(`Total Left (actual):    ${totalLeftActual}   | Stored: ${user.totalLeft ?? 'N/A'}`);
        console.log(`Active Left (actual):   ${activeLeftActual}  | Stored: ${user.activeLeft ?? 'N/A'}`);
        console.log(`Inactive Left (actual): ${inactiveLeftActual}`);

        console.log('\n==== DISCREPANCY CHECK ====');
        const rightMismatch = user.activeRight !== activeRightActual;
        const leftMismatch  = user.activeLeft  !== activeLeftActual;

        if (rightMismatch) {
            console.log(`RIGHT LEG DISCREPANCY: stored=${user.activeRight} | actual=${activeRightActual} | diff=${user.activeRight - activeRightActual}`);
        } else {
            console.log('RIGHT LEG: No discrepancy.');
        }

        if (leftMismatch) {
            console.log(`LEFT LEG DISCREPANCY: stored=${user.activeLeft} | actual=${activeLeftActual} | diff=${user.activeLeft - activeLeftActual}`);
        } else {
            console.log('LEFT LEG: No discrepancy.');
        }

        console.log('\n==== INACTIVE RIGHT LEG USERS DETAIL ====');
        const inactiveRightList = rightLegUsers.filter(u => u.status !== 'active');
        if (inactiveRightList.length === 0) {
            console.log('None — ALL right leg users have status = active. Bug must be in the count calculation logic, not the status field.');
        } else {
            inactiveRightList.forEach(u => {
                console.log(`memberId: ${u.memberId} | status: ${u.status} | isFirstPurchaseDone: ${u.isFirstPurchaseDone}`);
            });
        }

        process.exit(0);
    } catch (e) {
        console.error('\nFATAL ERROR:', e.message, e.stack);
        process.exit(1);
    }
}

start();
