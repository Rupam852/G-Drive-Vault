import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rupam.drivevault',
  appName: 'DriveVault',
  webDir: 'dist',
  plugins: {
    GoogleSignIn: {
      androidClientId: '366598728765-rvhkrkvmisgeu0tn27jatbsajbp12qsk.apps.googleusercontent.com',
      serverClientId: '366598728765-rvhkrkvmisgeu0tn27jatbsajbp12qsk.apps.googleusercontent.com'
    }
  }
};

export default config;
