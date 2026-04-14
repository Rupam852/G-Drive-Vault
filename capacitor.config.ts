import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rupam.drivevault',
  appName: 'DriveVault',
  webDir: 'dist',
  plugins: {
    GoogleSignIn: {
      androidClientId: '366598728765-rvhkrkvmisgeu0tn27jatbsajbp12qsk.apps.googleusercontent.com',
      serverClientId: '366598728765-r8pdfc9s1bf4mkplf3k250mqqnj7lkbk.apps.googleusercontent.com'
    }
  }
};

export default config;
