import dotenv from 'dotenv';
dotenv.config();

const Configs = {
    PORT: process.env.PORT || 8001,
    MONGO_URI: process.env.MONGO_URI,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // APITxT OTP integration (phone verification on registration)
    APITXT_AUTHKEY: process.env.APITXT_AUTHKEY,
    APITXT_BASE_URL: process.env.APITXT_BASE_URL || 'https://apitxt.com/api/sendOTP',
    OTP_VERIFICATION_REQUIRED: (process.env.OTP_VERIFICATION_REQUIRED || 'true') !== 'false',
}

export default Configs;