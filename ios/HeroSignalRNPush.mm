#import "HeroSignalRNPush.h"

#if __has_include(<HeroSignalReactNative/HeroSignalReactNative-Swift.h>)
#import <HeroSignalReactNative/HeroSignalReactNative-Swift.h>
#else
#import "HeroSignalReactNative-Swift.h"
#endif

@implementation HeroSignalRNPush

+ (void)didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  [HeroSignalRNBridge didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

+ (void)didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  [HeroSignalRNBridge didFailToRegisterForRemoteNotificationsWithError:error];
}

@end
