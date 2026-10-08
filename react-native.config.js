/**
 * React Native CLI autolinking yapılandırması. iOS podspec ve Android paketi otomatik bulunur;
 * Android paket sınıfı açıkça belirtilir.
 */
module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.herosignal.reactnative.HeroSignalPackage;',
        packageInstance: 'new HeroSignalPackage()',
      },
    },
  },
};
