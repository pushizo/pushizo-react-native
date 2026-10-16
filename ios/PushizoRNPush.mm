#import "PushizoRNPush.h"

#if __has_include(<PushizoReactNative/PushizoReactNative-Swift.h>)
#import <PushizoReactNative/PushizoReactNative-Swift.h>
#else
#import "PushizoReactNative-Swift.h"
#endif

@implementation PushizoRNPush

+ (void)didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  [PushizoRNBridge didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

+ (void)didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  [PushizoRNBridge didFailToRegisterForRemoteNotificationsWithError:error];
}

@end
