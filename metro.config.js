const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Defer heavy course curriculum module evaluation until the learner actually
// opens that specific language screen, eliminating cold-start and login stalls.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
