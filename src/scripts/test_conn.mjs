import mongoose from 'mongoose';

const URI = 'mongodb+srv://sarvasolutionvision_db_user:sarva1974%40@cluster0.jdrxvhw.mongodb.net/sarvasolution_t_main_db';

async function testConnection() {
    console.log('Testing connection to MongoDB...');
    try {
        await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
        console.log('SUCCESS: Connected to DB.');
        process.exit(0);
    } catch (err) {
        console.error('ERROR connecting to DB:', err.message);
        process.exit(1);
    }
}

testConnection();
