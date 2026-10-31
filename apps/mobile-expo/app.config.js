module.exports = ({config}) => {
  const qaBuild = process.env.SRD_EXPO_QA_BUILD === '1';
  if (qaBuild && process.env.EXPO_PUBLIC_SRD_QA_ONLY !== '1') {
    throw new Error('SRD_EXPO_QA_BUILD requires the local-host-only JavaScript guard.');
  }

  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ['expo-build-properties', {android: {usesCleartextTraffic: qaBuild}}],
    ],
  };
};
