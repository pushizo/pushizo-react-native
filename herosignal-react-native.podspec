require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "herosignal-react-native"
  s.version      = package["version"]
  s.summary      = "HeroSignal React Native SDK (iOS köprüsü)"
  s.description  = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/herosignal/herosignal.git", :tag => "react-native-v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  # Başlıklar yalnızca modül içinde kullanılır; umbrella başlığa girerse ObjC++ spec başlığı Swift modülünü bozar.
  s.private_header_files = "ios/**/*.h"
  s.swift_version = "5.9"
  s.frameworks = "UIKit", "UserNotifications"

  # Native iOS SDK. Yayın öncesi geliştirmede uygulama Podfile'ında:
  #   pod 'HeroSignal', :path => '<repo>/sdk/ios'
  s.dependency "HeroSignal", "~> 0.1"

  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
  }

  # React Native bağımlılıkları ve yeni mimari (codegen, RCT_NEW_ARCH_ENABLED) ayarları.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
