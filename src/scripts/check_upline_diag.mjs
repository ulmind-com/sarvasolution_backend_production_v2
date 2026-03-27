import mongoose from 'mongoose';

const URI = 'mongodb+srv://sarvasolutionvision_db_user:sarva1974%40@cluster0.jdrxvhw.mongodb.net/sarvasolution_t_main_db';
const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', userSchema);

async function start() {
    try {
        await mongoose.connect(URI, { serverSelectionTimeoutMS: 20000 });
        const memberId = 'SVS23286132';
        const user = await User.findOne({ memberId }).lean();
        
        console.log(`Checking Member: ${memberId}`);
        console.log(`Parent ID: ${user.parentId}`);
        console.log(`Leg Position: ${user.position}`);
        
        if (user.parentId) {
            const parent = await User.findOne({ memberId: user.parentId }).lean();
            console.log(`\nParent Member: ${parent.memberId}`);
            console.log(`Parent Stored Left Active:  ${parent.leftTeamActive}`);
            console.log(`Parent Stored Left Inactive: ${parent.leftTeamInactive}`);
            console.log(`Parent Stored Left Total:   ${parent.leftTeamCount}`);
            console.log(`Parent Stored Right Active:  ${parent.rightTeamActive}`);
            console.log(`Parent Stored Right Inactive: ${parent.rightTeamInactive}`);
            console.log(`Parent Stored Right Total:   ${parent.rightTeamCount}`);

            // Let's do a fast actual count on the parent's relevant leg to see if it's overcounted
            const legToCount = user.position === 'left' ? parent.leftChild : parent.rightChild;
            
            if (legToCount) {
                 const allUsers = await User.find({}, {
                    _id: 1, memberId: 1, status: 1,
                    leftChild: 1, rightChild: 1
                }).lean();
                
                const userMap = {};
                for (const u of allUsers) userMap[u._id.toString()] = u;
                
                let actualLegTotal = 0;
                let actualLegActive = 0;
                let actualLegInactive = 0;
                
                const queue = [legToCount.toString()];
                while(queue.length > 0) {
                    const id = queue.shift();
                    const current = userMap[id];
                    if (current) {
                        actualLegTotal++;
                        if (current.status === 'active') actualLegActive++;
                        else actualLegInactive++;
                        
                        if (current.leftChild) queue.push(current.leftChild.toString());
                        if (current.rightChild) queue.push(current.rightChild.toString());
                    }
                }
                
                console.log(`\n--- Actual Parent ${user.position.toUpperCase()} Leg Traversal ---`);
                console.log(`Actual Total:    ${actualLegTotal}`);
                console.log(`Actual Active:   ${actualLegActive}`);
                console.log(`Actual Inactive: ${actualLegInactive}`);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
start();
