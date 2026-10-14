// HeroSignal React Native modülü: JS çağrılarını Swift köprüsüne (HeroSignalRNBridge) iletir.
// Yeni mimaride codegen'in ürettiği NativeHeroSignalSpec protokolünü uygular (TurboModule), eski mimaride
// RCT_EXPORT_METHOD ile aynı metotları dışa aktarır. Olaylar RCTEventEmitter üzerinden gönderilir.
#import "HeroSignalRN.h"

#import <UIKit/UIKit.h>

#if __has_include(<HeroSignalReactNative/HeroSignalReactNative-Swift.h>)
#import <HeroSignalReactNative/HeroSignalReactNative-Swift.h>
#else
#import "HeroSignalReactNative-Swift.h"
#endif

@implementation HeroSignalRN {
  NSInteger _listenerCount;
}

RCT_EXPORT_MODULE(HeroSignal)

/// Erken başlatma: Info.plist'te `HeroSignalAppId` varsa SDK, uygulama açılışı biter bitmez (JS yüklenmeden) başlatılır.
/// Böylece UNUserNotificationCenter temsilcisi soğuk açılış tıklamasından önce kurulur.
+ (void)load
{
  [[NSNotificationCenter defaultCenter] addObserverForName:UIApplicationDidFinishLaunchingNotification
                                                    object:nil
                                                     queue:[NSOperationQueue mainQueue]
                                                usingBlock:^(NSNotification *note) {
                                                  [[HeroSignalRNBridge shared] autoInitializeWithLaunchOptions:note.userInfo];
                                                }];
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    __weak HeroSignalRN *weakSelf = self;
    [[HeroSignalRNBridge shared] attachWithEmitter:^(NSString *name, NSDictionary<NSString *, id> *body) {
      HeroSignalRN *strongSelf = weakSelf;
      // Dinleyici yokken gönderim RN uyarısı üretir; JS dinleyicisi yoksa olay yok sayılır (tıklamalar köprüde bekler).
      if (strongSelf != nil && strongSelf->_listenerCount > 0) {
        [strongSelf sendEventWithName:name body:body];
      }
    }];
  }
  return self;
}

- (void)invalidate
{
  [[HeroSignalRNBridge shared] detach];
  [super invalidate];
}

- (NSArray<NSString *> *)supportedEvents
{
  return [HeroSignalRNBridge supportedEvents];
}

- (void)startObserving
{
  _listenerCount = 1;
}

- (void)stopObserving
{
  _listenerCount = 0;
}

// addListener/removeListeners RCTEventEmitter'da dışa aktarılır; burada yalnızca köprüye dinlenen olay bildirilir.
- (void)addListener:(NSString *)eventName
{
  [super addListener:eventName];
  [[HeroSignalRNBridge shared] jsListenerAdded:eventName];
}

#pragma mark - Başlatma ve gizlilik

RCT_EXPORT_METHOD(initialize:(NSString *)appId
                  options:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] setup:appId options:options resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(setConsentGiven:(BOOL)given)
{
  [[HeroSignalRNBridge shared] setConsentGiven:given];
}

RCT_EXPORT_METHOD(login:(NSString *)externalId
                  identityHash:(NSString *_Nullable)identityHash
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] login:externalId identityHash:identityHash resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(logout)
{
  [[HeroSignalRNBridge shared] logout];
}

#pragma mark - Kullanıcı

RCT_EXPORT_METHOD(addTags:(NSDictionary *)tags
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] addTags:tags resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeTags:(NSArray *)keys
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] removeTags:keys resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(getTags:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[HeroSignalRNBridge shared] getTags]);
}

RCT_EXPORT_METHOD(addAliases:(NSDictionary *)aliases
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] addAliases:aliases resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeAlias:(NSString *)label
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] removeAlias:label resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(setLanguage:(NSString *)code
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] setLanguage:code resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(addEmail:(NSString *)email
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] contact:@"addEmail" address:email resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeEmail:(NSString *)email
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] contact:@"removeEmail" address:email resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(addSms:(NSString *)phoneNumber
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] contact:@"addSms" address:phoneNumber resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeSms:(NSString *)phoneNumber
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] contact:@"removeSms" address:phoneNumber resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(getExternalId:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[HeroSignalRNBridge shared] externalId]);
}

RCT_EXPORT_METHOD(getUserId:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[HeroSignalRNBridge shared] userId]);
}

RCT_EXPORT_METHOD(getEmails:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[HeroSignalRNBridge shared] emails]);
}

RCT_EXPORT_METHOD(getSmsNumbers:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[HeroSignalRNBridge shared] smsNumbers]);
}

#pragma mark - Tercihler

RCT_EXPORT_METHOD(getPreferences:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] getPreferences:resolve reject:reject];
}

RCT_EXPORT_METHOD(setPreferences:(NSArray *)preferences
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] setPreferences:preferences resolve:resolve reject:reject];
}

#pragma mark - Push aboneliği

RCT_EXPORT_METHOD(getPushSubscriptionState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] getPushSubscriptionState:resolve];
}

RCT_EXPORT_METHOD(optIn)
{
  [[HeroSignalRNBridge shared] optIn];
}

RCT_EXPORT_METHOD(optOut)
{
  [[HeroSignalRNBridge shared] optOut];
}

#pragma mark - Bildirimler

RCT_EXPORT_METHOD(getPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] getPermission:resolve];
}

RCT_EXPORT_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] requestPermission:resolve];
}

RCT_EXPORT_METHOD(clearAll)
{
  [[HeroSignalRNBridge shared] clearAll];
}

RCT_EXPORT_METHOD(removeNotification:(NSString *)identifier
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] removeNotification:identifier resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeGroupedNotifications:(NSString *)group
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] removeGroupedNotifications:group resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(setForegroundHandlerEnabled:(BOOL)enabled)
{
  [[HeroSignalRNBridge shared] setForegroundHandlerEnabled:enabled];
}

RCT_EXPORT_METHOD(displayNotification:(NSString *)notificationId)
{
  [[HeroSignalRNBridge shared] displayNotification:notificationId];
}

RCT_EXPORT_METHOD(preventDefault:(NSString *)notificationId)
{
  [[HeroSignalRNBridge shared] preventDefault:notificationId];
}

#pragma mark - Oturum

RCT_EXPORT_METHOD(sendEvent:(NSString *)name properties:(NSDictionary *)properties value:(NSNumber *_Nullable)value)
{
  [[HeroSignalRNBridge shared] sendEvent:name properties:properties value:value];
}

#pragma mark - In-app

RCT_EXPORT_METHOD(addTriggers:(NSDictionary *)triggers
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] addTriggers:triggers resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeTriggers:(NSArray *)keys)
{
  [[HeroSignalRNBridge shared] removeTriggers:keys];
}

RCT_EXPORT_METHOD(clearTriggers)
{
  [[HeroSignalRNBridge shared] clearTriggers];
}

RCT_EXPORT_METHOD(getTriggers:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] getTriggers:resolve];
}

RCT_EXPORT_METHOD(setScreen:(NSString *_Nullable)name)
{
  [[HeroSignalRNBridge shared] setScreen:name];
}

RCT_EXPORT_METHOD(setInAppPaused:(BOOL)paused)
{
  [[HeroSignalRNBridge shared] setInAppPaused:paused];
}

RCT_EXPORT_METHOD(getInAppPaused:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] getInAppPaused:resolve];
}

#pragma mark - Bildirim kutusu

RCT_EXPORT_METHOD(inboxList:(double)limit
                  cursor:(NSString *_Nullable)cursor
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] inboxList:limit cursor:cursor resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(inboxMarkRead:(NSString *)id
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] inboxMarkRead:id resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(inboxMarkAllRead:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] inboxMarkAllRead:resolve reject:reject];
}

RCT_EXPORT_METHOD(inboxArchive:(NSString *)id
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] inboxArchive:id resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(inboxUnreadCount:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[HeroSignalRNBridge shared] inboxUnreadCount:resolve reject:reject];
}

#pragma mark - Hata ayıklama

RCT_EXPORT_METHOD(setLogLevel:(NSString *)level)
{
  [[HeroSignalRNBridge shared] setLogLevel:level];
}

#pragma mark - TurboModule

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHeroSignalSpecJSI>(params);
}
#endif

@end
