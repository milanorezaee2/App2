const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICE_NAME = 'com.oney.WebRTCModule.MediaProjectionService';

/** Keep WebRTC voice calls, but remove its unused Android screen-capture service. */
module.exports = function withRemoveScreenCaptureService(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) throw new Error('Android application manifest node was not found');

    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    application.service = application.service || [];

    const existing = application.service.find((service) => {
      const name = service.$?.['android:name'];
      return name === SERVICE_NAME || name === '.MediaProjectionService';
    });
    if (existing) {
      existing.$ = { ...existing.$, 'android:name': SERVICE_NAME, 'tools:node': 'remove' };
    } else {
      application.service.push({
        $: { 'android:name': SERVICE_NAME, 'tools:node': 'remove' },
      });
    }

    return mod;
  });
};
