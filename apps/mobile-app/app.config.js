export default {
  expo: {
    sdkVersion: '54.0.0',
    newArchEnabled: true,
    name: 'Inti',
    slug: 'inti-mobile',
    version: '1.0.0',
    runtimeVersion: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.inti.app',
      buildNumber: '1',
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          'Permite acceso a tu galería para seleccionar imágenes y videos dentro de la app.',
        NSPhotoLibraryAddUsageDescription:
          'Permite guardar temporalmente archivos multimedia editados dentro de la app.',
      },
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      package: 'com.inti.app',
      versionCode: 1,
      permissions: [
        'INTERNET',
      ],
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro'
    },
    plugins: [
      'expo-router',
      [
        'expo-image-picker',
        {
          photosPermission:
            'Permite acceso a tu galería para seleccionar imágenes y videos dentro de la app.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true
    },
    scheme: 'inti',
    updates: {
      url: 'https://u.expo.dev/c71fd270-4c2d-43bb-89eb-523ea49d3633',
    },
    extra: {
      eas: {
        projectId: 'c71fd270-4c2d-43bb-89eb-523ea49d3633',
      },
      // Override locally with API_URL or EXPO_PUBLIC_API_URL when needed.
      apiUrl:
        process.env.API_URL ||
        process.env.EXPO_PUBLIC_API_URL ||
        'https://api.intihubs.com/api',
      privacyPolicyUrl:
        process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ||
        'https://intihubs.com/privacy-policy',
      termsConditionsUrl:
        process.env.EXPO_PUBLIC_TERMS_CONDITIONS_URL ||
        'https://intihubs.com/terms-and-conditions',
      supportUrl:
        process.env.EXPO_PUBLIC_SUPPORT_URL ||
        'https://intihubs.com/contact',
      communityGuidelinesUrl:
        process.env.EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL ||
        'https://intihubs.com/community-guidelines',
      accountDeletionUrl:
        process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL ||
        'https://intihubs.com/account-deletion',
      creatorTermsUrl:
        process.env.EXPO_PUBLIC_CREATOR_TERMS_URL ||
        'https://intihubs.com/creator-terms',
      supportEmail:
        process.env.EXPO_PUBLIC_SUPPORT_EMAIL ||
        'support@intihubs.com',
    }
  }
};
