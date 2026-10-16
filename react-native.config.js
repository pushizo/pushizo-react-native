/**
 * React Native CLI autolinking yapılandırması (Android paketi ve iOS podspec'i).
 * @type {import('@react-native-community/cli-types').UserDependencyConfig}
 */
module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.pushizo.reactnative.PushizoPackage;',
        packageInstance: 'new PushizoPackage()',
      },
      ios: {
        podspecPath: './pushizo-react-native.podspec',
      },
    },
  },
};
