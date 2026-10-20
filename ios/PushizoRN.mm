// Pushizo React Native modülü: JS çağrılarını Swift köprüsüne (PushizoRNBridge) iletir.
// Yeni mimaride codegen'in ürettiği NativePushizoSpec protokolünü uygular (TurboModule), eski mimaride
// RCT_EXPORT_METHOD ile aynı metotları dışa aktarır. Olaylar RCTEventEmitter üzerinden gönderilir.
#import "PushizoRN.h"

#import <UIKit/UIKit.h>

#if __has_include(<PushizoReactNative/PushizoReactNative-Swift.h>)
#import <PushizoReactNative/PushizoReactNative-Swift.h>
#else
#import "PushizoReactNative-Swift.h"
#endif

@implementation PushizoRN {
  NSInteger _listenerCount;
}

RCT_EXPORT_MODULE(Pushizo)

/// Erken başlatma: Info.plist'te `PushizoAppId` varsa SDK, uygulama açılışı biter bitmez (JS yüklenmeden) başlatılır.
/// Böylece UNUserNotificationCenter temsilcisi soğuk açılış tıklamasından önce kurulur.
+ (void)load
{
  [[NSNotificationCenter defaultCenter] addObserverForName:UIApplicationDidFinishLaunchingNotification
                                                    object:nil
                                                     queue:[NSOperationQueue mainQueue]
                                                usingBlock:^(NSNotification *note) {
                                                  [[PushizoRNBridge shared] autoInitializeWithLaunchOptions:note.userInfo];
                                                }];
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    __weak PushizoRN *weakSelf = self;
    [[PushizoRNBridge shared] attachWithEmitter:^(NSString *name, NSDictionary<NSString *, id> *body) {
      PushizoRN *strongSelf = weakSelf;
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
  [[PushizoRNBridge shared] detach];
  [super invalidate];
}

- (NSArray<NSString *> *)supportedEvents
{
  return [PushizoRNBridge supportedEvents];
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
  [[PushizoRNBridge shared] jsListenerAdded:eventName];
}

#pragma mark - Başlatma ve gizlilik

RCT_EXPORT_METHOD(initialize:(NSString *)appId
                  options:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] setup:appId options:options resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(setConsentGiven:(BOOL)given)
{
  [[PushizoRNBridge shared] setConsentGiven:given];
}

RCT_EXPORT_METHOD(login:(NSString *)externalId
                  identityHash:(NSString *_Nullable)identityHash
                  jwt:(NSString *_Nullable)jwt
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] login:externalId identityHash:identityHash jwt:jwt resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(updateUserJwt:(NSString *)jwt
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] updateUserJwt:jwt resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(logout)
{
  [[PushizoRNBridge shared] logout];
}

#pragma mark - Kullanıcı

RCT_EXPORT_METHOD(addTags:(NSDictionary *)tags
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] addTags:tags resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeTags:(NSArray *)keys
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] removeTags:keys resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(getTags:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[PushizoRNBridge shared] getTags]);
}

RCT_EXPORT_METHOD(addAliases:(NSDictionary *)aliases
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] addAliases:aliases resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeAlias:(NSString *)label
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] removeAlias:label resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(setLanguage:(NSString *)code
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] setLanguage:code resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(addEmail:(NSString *)email
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] contact:@"addEmail" address:email resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeEmail:(NSString *)email
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] contact:@"removeEmail" address:email resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(addSms:(NSString *)phoneNumber
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] contact:@"addSms" address:phoneNumber resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeSms:(NSString *)phoneNumber
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] contact:@"removeSms" address:phoneNumber resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(getExternalId:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[PushizoRNBridge shared] externalId]);
}

RCT_EXPORT_METHOD(getUserId:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[PushizoRNBridge shared] userId]);
}

RCT_EXPORT_METHOD(getEmails:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[PushizoRNBridge shared] emails]);
}

RCT_EXPORT_METHOD(getSmsNumbers:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[PushizoRNBridge shared] smsNumbers]);
}

#pragma mark - Tercihler

RCT_EXPORT_METHOD(getPreferences:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] getPreferences:resolve reject:reject];
}

RCT_EXPORT_METHOD(setPreferences:(NSArray *)preferences
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] setPreferences:preferences resolve:resolve reject:reject];
}

#pragma mark - Push aboneliği

RCT_EXPORT_METHOD(getPushSubscriptionState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] getPushSubscriptionState:resolve];
}

RCT_EXPORT_METHOD(optIn)
{
  [[PushizoRNBridge shared] optIn];
}

RCT_EXPORT_METHOD(optOut)
{
  [[PushizoRNBridge shared] optOut];
}

#pragma mark - Bildirimler

RCT_EXPORT_METHOD(getPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] getPermission:resolve];
}

RCT_EXPORT_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] requestPermission:resolve];
}

RCT_EXPORT_METHOD(clearAll)
{
  [[PushizoRNBridge shared] clearAll];
}

RCT_EXPORT_METHOD(removeNotification:(NSString *)identifier
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] removeNotification:identifier resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeGroupedNotifications:(NSString *)group
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] removeGroupedNotifications:group resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(setForegroundHandlerEnabled:(BOOL)enabled)
{
  [[PushizoRNBridge shared] setForegroundHandlerEnabled:enabled];
}

RCT_EXPORT_METHOD(displayNotification:(NSString *)notificationId)
{
  [[PushizoRNBridge shared] displayNotification:notificationId];
}

RCT_EXPORT_METHOD(preventDefault:(NSString *)notificationId)
{
  [[PushizoRNBridge shared] preventDefault:notificationId];
}

#pragma mark - Oturum

RCT_EXPORT_METHOD(sendEvent:(NSString *)name properties:(NSDictionary *)properties value:(NSNumber *_Nullable)value)
{
  [[PushizoRNBridge shared] sendEvent:name properties:properties value:value];
}

#pragma mark - In-app

RCT_EXPORT_METHOD(addTriggers:(NSDictionary *)triggers
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] addTriggers:triggers resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(removeTriggers:(NSArray *)keys)
{
  [[PushizoRNBridge shared] removeTriggers:keys];
}

RCT_EXPORT_METHOD(clearTriggers)
{
  [[PushizoRNBridge shared] clearTriggers];
}

RCT_EXPORT_METHOD(getTriggers:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] getTriggers:resolve];
}

RCT_EXPORT_METHOD(setScreen:(NSString *_Nullable)name)
{
  [[PushizoRNBridge shared] setScreen:name];
}

RCT_EXPORT_METHOD(setInAppPaused:(BOOL)paused)
{
  [[PushizoRNBridge shared] setInAppPaused:paused];
}

RCT_EXPORT_METHOD(getInAppPaused:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] getInAppPaused:resolve];
}

#pragma mark - Bildirim kutusu

RCT_EXPORT_METHOD(inboxList:(double)limit
                  cursor:(NSString *_Nullable)cursor
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] inboxList:limit cursor:cursor resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(inboxMarkRead:(NSString *)id
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] inboxMarkRead:id resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(inboxMarkAllRead:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] inboxMarkAllRead:resolve reject:reject];
}

RCT_EXPORT_METHOD(inboxArchive:(NSString *)id
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] inboxArchive:id resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(inboxUnreadCount:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] inboxUnreadCount:resolve reject:reject];
}

#pragma mark - Canlı sohbet

RCT_EXPORT_METHOD(chatStart:(NSString *_Nullable)name
                  email:(NSString *_Nullable)email
                  language:(NSString *_Nullable)language
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatStart:name email:email language:language resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatGetConfig:(NSString *_Nullable)language
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatGetConfig:language resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatGetConversation:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatGetConversation:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatGetMessages:(NSNumber *_Nullable)afterSeq
                  beforeSeq:(NSNumber *_Nullable)beforeSeq
                  limit:(double)limit
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatGetMessages:afterSeq beforeSeq:beforeSeq limit:limit resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatSendMessage:(NSString *)text
                  optionId:(NSString *_Nullable)optionId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatSendMessage:text optionId:optionId resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatSendAttachmentData:(NSString *)base64
                  fileName:(NSString *)fileName
                  mimeType:(NSString *)mimeType
                  text:(NSString *_Nullable)text
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatSendAttachmentData:base64 fileName:fileName mimeType:mimeType text:text resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatSendAttachmentUri:(NSString *)uri
                  fileName:(NSString *)fileName
                  mimeType:(NSString *)mimeType
                  text:(NSString *_Nullable)text
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatSendAttachmentUri:uri fileName:fileName mimeType:mimeType text:text resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatMarkRead:(double)seq
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatMarkRead:seq resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatRefreshUnreadCount:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatRefreshUnreadCount:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatGetUnreadCount:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve(@([[PushizoRNBridge shared] chatUnreadCount]));
}

RCT_EXPORT_METHOD(chatLeaveOfflineMessage:(NSString *)email
                  text:(NSString *)text
                  name:(NSString *_Nullable)name
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatLeaveOfflineMessage:email text:text name:name resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatSetTyping:(BOOL)typing)
{
  [[PushizoRNBridge shared] chatSetTyping:typing];
}

RCT_EXPORT_METHOD(chatStartListening)
{
  [[PushizoRNBridge shared] chatStartListening];
}

RCT_EXPORT_METHOD(chatStopListening)
{
  [[PushizoRNBridge shared] chatStopListening];
}

RCT_EXPORT_METHOD(chatAttachmentUrl:(NSString *)attachmentId
                  download:(BOOL)download
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] chatAttachmentUrl:attachmentId download:download resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(chatGetVisitorId:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve([[PushizoRNBridge shared] chatVisitorId]);
}

#pragma mark - Live Activities

RCT_EXPORT_METHOD(setupDefaultLiveActivity:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] setupDefaultLiveActivity:resolve reject:reject];
}

RCT_EXPORT_METHOD(startDefaultLiveActivity:(NSString *)activityId
                  attributes:(NSDictionary *)attributes
                  contentState:(NSDictionary *)contentState
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] startDefaultLiveActivity:activityId attributes:attributes contentState:contentState resolve:resolve reject:reject];
}

#pragma mark - Konum

RCT_EXPORT_METHOD(setLocationShared:(BOOL)shared)
{
  [[PushizoRNBridge shared] setLocationShared:shared];
}

RCT_EXPORT_METHOD(isLocationShared:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] isLocationShared:resolve];
}

RCT_EXPORT_METHOD(requestLocationPermission:(NSString *_Nullable)rationale
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[PushizoRNBridge shared] requestLocationPermission:rationale resolve:resolve];
}

#pragma mark - Hata ayıklama

RCT_EXPORT_METHOD(setLogLevel:(NSString *)level)
{
  [[PushizoRNBridge shared] setLogLevel:level];
}

#pragma mark - TurboModule

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativePushizoSpecJSI>(params);
}
#endif

@end
