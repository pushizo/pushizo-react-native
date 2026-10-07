require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "herosignal-react-native"
  s.module_name  = "HeroSignalReactNative"
  s.header_dir   = "HeroSignalReactNative"
  s.version      = package["version"]
  s.summary      = "HeroSignal React Native SDK (iOS köprüsü)"
  s.description  = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = { "HeroSignal" => "sdk@herosignal.dev" }
  s.platforms    = { :ios => "15.0" }
  s.source       = { :git => "https://github.com/herosignal/herosignal.git", :tag => "react-native-v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.public_header_files = "ios/HeroSignalRNPush.h"
  s.swift_version = "5.9"
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  # Yerel SDK. Monorepo / yerel geliştirme: uygulama Podfile'ında
  #   pod 'HeroSignal', :path => '<repo>/sdk/ios'
  s.dependency "HeroSignal", "~> 0.1"

  # React Native ≥ 0.71: yeni/eski mimari bağımlılıkları ve codegen (RNHeroSignalSpec) ayarları.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
