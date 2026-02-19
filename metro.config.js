const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force axios to always use the browser build (XHR adapter)
// and never resolve the Node.js build (which imports `crypto`)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'axios') {
    return context.resolveRequest(
      context,
      'axios/dist/browser/axios.cjs',
      platform
    );
  }

  if (moduleName === 'axios/dist/node/axios.cjs') {
    return context.resolveRequest(
      context,
      'axios/dist/browser/axios.cjs',
      platform
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
