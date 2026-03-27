import mongoose from 'mongoose';

const URI = 'mongodb+srv://sarvasolutionvision_db_user:sarva1974%40@cluster0.jdrxvhw.mongodb.net/sarvasolution_t_main_db';
const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', userSchema);

async function start() {
    try {
        await mongoose.connect(URI, { serverSelectionTimeoutMS: 20000 });
        const memberId = 'SVS23286132';
        const user = await User.findOne({ memberId }, {
            memberId: 1, 
            leftTeamActive: 1, leftTeamInactive: 1,
            rightTeamActive: 1, rightTeamInactive: 1,
            leftTeamCount: 1, rightTeamCount: 1
        }).lean();

        console.log("Stored DB Metrics for SVS23286132:\n");
        console.log(JSON.stringify(user, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

start();
