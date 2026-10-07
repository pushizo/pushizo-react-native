/**
 * React Native CLI autolinking yapılandırması (Android paketi ve iOS podspec'i).
 * @type {import('@react-native-community/cli-types').UserDependencyConfig}
 */
module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.herosignal.reactnative.HeroSignalPackage;',
        packageInstance: 'new HeroSignalPackage()',
      },
      ios: {
        podspecPath: './herosignal-react-native.podspec',
      },
    },
  },
};
