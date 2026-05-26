import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ancientq.app',
  appName: 'AncientQ',
  webDir: 'dist',
  server: {
    // No server URL = fully offline, loads from local assets
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#060710',
    // Splash screen color matches app background
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#060710',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#060710',
    }
  }
};

export default config;
