// APNs token'ını HeroSignal'e iletmek için AppDelegate yardımcıları (Objective-C AppDelegate'ler için).
// Swift AppDelegate'te doğrudan `import HeroSignal` ve `HeroSignal.setDeviceToken(deviceToken)` kullanılabilir.
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface HeroSignalRNPush : NSObject

/// `application:didRegisterForRemoteNotificationsWithDeviceToken:` içinden çağrılır.
+ (void)didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken;

/// `application:didFailToRegisterForRemoteNotificationsWithError:` içinden çağrılır.
+ (void)didFailToRegisterForRemoteNotificationsWithError:(NSError *)error;

@end

NS_ASSUME_NONNULL_END
