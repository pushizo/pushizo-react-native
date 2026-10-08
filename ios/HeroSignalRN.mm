#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNHeroSignalSpec/RNHeroSignalSpec.h>
#endif

#import "HeroSignalAppDelegateProxy.h"
#import "HeroSignalSwiftBridge.h"

/**
 React Native modülü `HeroSignal` (yeni mimaride TurboModule, eski mimaride bridge modülü). Yöntem imzaları
 codegen'in `src/NativeHeroSignal.ts`'ten ürettiği `NativeHeroSignalSpec` protokolüyle birebir aynıdır;
 iş mantığı Swift tarafındaki `HeroSignalRNImpl` içindedir. Sınıf adı `codegenConfig.ios.modulesProvider`
 ile eşleşir.
 */
#ifdef RCT_NEW_ARCH_ENABLED
@interface HeroSignalRN : RCTEventEmitter <NativeHeroSignalSpec>
#else
@interface HeroSignalRN : RCTEventEmitter <RCTBridgeModule>
#endif
@end

@implementation HeroSignalRN {
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE(HeroSignal)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

/// SDK UIKit ve UNUserNotificationCenter ile çalıştığı için tüm çağrılar ana iş parçacığındadır.
- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (instancetype)init
{
  if (self = [super init]) {
    __weak HeroSignalRN *weakSelf = self;
    [HeroSignalRNImpl.shared attachEmitter:^(NSString *name, NSDictionary<NSString *, id> *body) {
      [weakSelf emit:name body:body];
    }];
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[
    HeroSignalRNImpl.eventClick,
    HeroSignalRNImpl.eventWillDisplay,
    HeroSignalRNImpl.eventSubscription,
    HeroSignalRNImpl.eventInAppClick,
    HeroSignalRNImpl.eventInAppLifecycle,
  ];
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

- (void)emit:(NSString *)name body:(NSDictionary *)body
{
  if (_hasListeners) {
    [self sendEventWithName:name body:body];
  }
}

/// İlk tıklama dinleyicisi eklenince soğuk açılışta bekletilen tıklamalar iletilir.
- (void)addListener:(NSString *)eventName
{
  [super addListener:eventName];
  if ([eventName isEqualToString:HeroSignalRNImpl.eventClick]) {
    [HeroSignalRNImpl.shared markClickListenerReady];
  }
}

- (void)removeListeners:(double)count
{
  [super removeListeners:count];
}

- (void)invalidate
{
  [HeroSignalRNImpl.shared detach];
  if ([RCTEventEmitter instancesRespondToSelector:@selector(invalidate)]) {
    [super invalidate];
  }
}

#pragma mark - Başlatma ve gizlilik

RCT_EXPORT_METHOD(initialize:(NSString *)appId options:(NSDictionary *)options)
{
  [HeroSignalRNImpl.shared initializeWithAppId:appId options:options ?: @{}];
  [HeroSignalAppDelegateProxy install];
}

RCT_EXPORT_METHOD(setConsentRequired:(BOOL)required)
{
  [HeroSignalRNImpl.shared setConsentRequired:required];
}

RCT_EXPORT_METHOD(setConsentGiven:(BOOL)given)
{
  [HeroSignalRNImpl.shared setConsentGiven:given];
}

RCT_EXPORT_METHOD(login:(NSString *)externalId identityHash:(NSString *_Nullable)identityHash)
{
  [HeroSignalRNImpl.shared loginWithExternalId:externalId identityHash:identityHash];
}

RCT_EXPORT_METHOD(logout)
{
  [HeroSignalRNImpl.shared logout];
}

#pragma mark - Kullanıcı

RCT_EXPORT_METHOD(addTags:(NSDictionary *)tags)
{
  [HeroSignalRNImpl.shared addTags:tags ?: @{}];
}

RCT_EXPORT_METHOD(removeTags:(NSArray *)keys)
{
  [HeroSignalRNImpl.shared removeTags:keys ?: @[]];
}

RCT_EXPORT_METHOD(getTags:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared getTagsWithResolve:resolve];
}

RCT_EXPORT_METHOD(addAliases:(NSDictionary *)aliases)
{
  [HeroSignalRNImpl.shared addAliases:aliases ?: @{}];
}

RCT_EXPORT_METHOD(removeAlias:(NSString *)label)
{
  [HeroSignalRNImpl.shared removeAlias:label];
}

RCT_EXPORT_METHOD(setLanguage:(NSString *)code)
{
  [HeroSignalRNImpl.shared setLanguage:code];
}

RCT_EXPORT_METHOD(addEmail:(NSString *)email resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared addEmail:email resolve:resolve reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

RCT_EXPORT_METHOD(removeEmail:(NSString *)email resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared removeEmail:email resolve:resolve reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

RCT_EXPORT_METHOD(addSms:(NSString *)phoneNumber resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared addSms:phoneNumber resolve:resolve reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

RCT_EXPORT_METHOD(removeSms:(NSString *)phoneNumber resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared removeSms:phoneNumber resolve:resolve reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

RCT_EXPORT_METHOD(getExternalId:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared getExternalIdWithResolve:resolve];
}

RCT_EXPORT_METHOD(getUserId:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared getUserIdWithResolve:resolve];
}

#pragma mark - Push aboneliği

RCT_EXPORT_METHOD(getPushSubscriptionState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared getPushSubscriptionStateWithResolve:resolve];
}

RCT_EXPORT_METHOD(optIn)
{
  [HeroSignalRNImpl.shared optIn];
}

RCT_EXPORT_METHOD(optOut)
{
  [HeroSignalRNImpl.shared optOut];
}

#pragma mark - Bildirimler

RCT_EXPORT_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared requestPermissionWithResolve:resolve];
}

RCT_EXPORT_METHOD(getPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared getPermissionWithResolve:resolve];
}

RCT_EXPORT_METHOD(setForegroundHandlerEnabled:(BOOL)enabled)
{
  [HeroSignalRNImpl.shared setForegroundHandlerEnabled:enabled];
}

RCT_EXPORT_METHOD(completeForegroundDisplay:(NSString *)eventId display:(BOOL)display)
{
  [HeroSignalRNImpl.shared completeForegroundDisplay:eventId display:display];
}

RCT_EXPORT_METHOD(displayNotification:(NSString *)eventId)
{
  [HeroSignalRNImpl.shared displayNotification:eventId];
}

RCT_EXPORT_METHOD(clearAll)
{
  [HeroSignalRNImpl.shared clearAll];
}

RCT_EXPORT_METHOD(removeNotification:(NSString *)id)
{
  [HeroSignalRNImpl.shared removeNotification:id];
}

RCT_EXPORT_METHOD(removeGroupedNotifications:(NSString *)group)
{
  [HeroSignalRNImpl.shared removeGroupedNotifications:group];
}

#pragma mark - Oturum

RCT_EXPORT_METHOD(sendEvent:(NSString *)name properties:(NSDictionary *)properties value:(double)value hasValue:(BOOL)hasValue)
{
  [HeroSignalRNImpl.shared sendEvent:name properties:properties ?: @{} value:value hasValue:hasValue];
}

#pragma mark - In-app

RCT_EXPORT_METHOD(addTriggers:(NSDictionary *)triggers)
{
  [HeroSignalRNImpl.shared addTriggers:triggers ?: @{}];
}

RCT_EXPORT_METHOD(removeTriggers:(NSArray *)keys)
{
  [HeroSignalRNImpl.shared removeTriggers:keys ?: @[]];
}

RCT_EXPORT_METHOD(clearTriggers)
{
  [HeroSignalRNImpl.shared clearTriggers];
}

RCT_EXPORT_METHOD(getTriggers:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared getTriggersWithResolve:resolve];
}

RCT_EXPORT_METHOD(setScreen:(NSString *_Nullable)name)
{
  [HeroSignalRNImpl.shared setScreen:name];
}

RCT_EXPORT_METHOD(setInAppPaused:(BOOL)paused)
{
  [HeroSignalRNImpl.shared setInAppPaused:paused];
}

RCT_EXPORT_METHOD(getInAppPaused:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared getInAppPausedWithResolve:resolve];
}

#pragma mark - Bildirim kutusu

RCT_EXPORT_METHOD(inboxList:(double)limit cursor:(NSString *_Nullable)cursor resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared inboxList:(NSInteger)limit cursor:cursor resolve:resolve reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

RCT_EXPORT_METHOD(inboxMarkRead:(NSString *)id resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared inboxMarkRead:id resolve:resolve reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

RCT_EXPORT_METHOD(inboxMarkAllRead:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared inboxMarkAllReadWithResolve:resolve reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

RCT_EXPORT_METHOD(inboxArchive:(NSString *)id resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared inboxArchive:id resolve:resolve reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

RCT_EXPORT_METHOD(inboxUnreadCount:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [HeroSignalRNImpl.shared inboxUnreadCountWithResolve:resolve reject:^(NSString *code, NSString *message) {
    reject(code, message, nil);
  }];
}

#pragma mark - Hata ayıklama

RCT_EXPORT_METHOD(setLogLevel:(NSString *)level)
{
  [HeroSignalRNImpl.shared setLogLevel:level];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHeroSignalSpecJSI>(params);
}
#endif

@end
