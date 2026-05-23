import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rupam.drivevault',
  appName: 'DriveVault',
  webDir: 'dist',
  plugins: {
    GoogleSignIn: {
      androidClientId: '443871816940-921g8ap80g04qokuhst6t6leo6v8dqrk.apps.googleusercontent.com',
      serverClientId: '443871816940-j8ifmrgsd4f0s1to4bttjm3uh93ujl2l.apps.googleusercontent.com'
    }
  }
};

export default config;
