#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 APNs token'ını uygulama koduna dokunmadan SDK'ya iletir: AppDelegate'in
 `didRegisterForRemoteNotificationsWithDeviceToken` / `didFailToRegister…` yöntemleri sarmalanır (mevcut
 uygulama kodu çağrılmaya devam eder). Ayrıca açılış seçenekleri (bildirimden soğuk açılış) yakalanır.
 */
@interface HeroSignalAppDelegateProxy : NSObject

/// Ana iş parçacığında, `HeroSignal.initialize` sırasında bir kez çağrılır.
+ (void)install;

@end

NS_ASSUME_NONNULL_END
