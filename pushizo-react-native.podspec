require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "pushizo-react-native"
  s.module_name  = "PushizoReactNative"
  s.header_dir   = "PushizoReactNative"
  s.version      = package["version"]
  s.summary      = "Pushizo React Native SDK (iOS köprüsü)"
  s.description  = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = { "Pushizo" => "bildirim@pushizo.com" }
  s.platforms    = { :ios => "15.0" }
  s.source       = { :git => "https://github.com/exec0de/pushizo.git", :tag => "react-native-v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.public_header_files = "ios/PushizoRNPush.h"
  s.swift_version = "5.9"
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  # Yerel SDK. Monorepo / yerel geliştirme: uygulama Podfile'ında
  #   pod 'Pushizo', :path => '<repo>/sdk/ios'
  s.dependency "Pushizo", "~> 0.1"

  # React Native ≥ 0.71: yeni/eski mimari bağımlılıkları ve codegen (RNPushizoSpec) ayarları.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
