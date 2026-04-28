import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bk.LkMaxzBlock',
  appName: 'LkMaxzBlock',
  webDir: 'www',
  plugins: {
    Splashscreen: {
      launchshowduration: 2000,
      launchAutoHide: true,
      backroundColor: '#09111f',
      androidSplashResourcesName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
