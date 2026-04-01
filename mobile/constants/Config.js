import { Platform } from 'react-native';

const Config = {
  // Change to your machine's local IP when testing on a physical device
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',

  // RevenueCat keys — stored in .env, never committed to git
  REVENUECAT_IOS_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '',
  REVENUECAT_ANDROID_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',
  REVENUECAT_API_KEY: Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || ''
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',

  // RevenueCat product identifiers
  PRO_MONTHLY_ID: 'ghostjob_pro_monthly',
  PRO_ANNUAL_ID: 'ghostjob_pro_annual',
};

export default Config;
