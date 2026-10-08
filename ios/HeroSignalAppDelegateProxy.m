#import "HeroSignalAppDelegateProxy.h"
#import "HeroSignalSwiftBridge.h"

#import <UIKit/UIKit.h>
#import <objc/runtime.h>

static IMP hsOriginalDidRegister = NULL;
static IMP hsOriginalDidFail = NULL;

static void hs_didRegister(id self, SEL _cmd, UIApplication *application, NSData *deviceToken)
{
  [HeroSignalRNImpl setDeviceToken:deviceToken];
  if (hsOriginalDidRegister) {
    ((void (*)(id, SEL, UIApplication *, NSData *))hsOriginalDidRegister)(self, _cmd, application, deviceToken);
  }
}

static void hs_didFail(id self, SEL _cmd, UIApplication *application, NSError *error)
{
  [HeroSignalRNImpl setDeviceTokenError:error];
  if (hsOriginalDidFail) {
    ((void (*)(id, SEL, UIApplication *, NSError *))hsOriginalDidFail)(self, _cmd, application, error);
  }
}

/// Yöntemi sarmalar; sınıf (veya üst sınıfı) yöntemi zaten uyguluyorsa orijinali saklanır.
/// Dönüş: yöntem sınıfa yeni eklendiyse YES (UIKit'in yanıt önbelleği yenilenmeli).
static BOOL hs_swizzle(Class cls, SEL selector, IMP replacement, IMP *original)
{
  Method existing = class_getInstanceMethod(cls, selector);
  if (existing) {
    const char *types = method_getTypeEncoding(existing);
    if (class_addMethod(cls, selector, replacement, types)) {
      // Yöntem üst sınıftan geliyordu: alt sınıfa eklendi, üst sınıf uygulaması çağrılmaya devam eder.
      *original = method_getImplementation(existing);
    } else {
      *original = method_setImplementation(existing, replacement);
    }
    return NO;
  }
  *original = NULL;
  class_addMethod(cls, selector, replacement, "v@:@@");
  return YES;
}

@implementation HeroSignalAppDelegateProxy

+ (void)load
{
  // Bildirime dokunularak yapılan soğuk açılışta tıklama bilgisi açılış seçeneklerindedir;
  // JS `initialize` daha sonra çağrıldığı için seçenekler burada saklanır.
  [[NSNotificationCenter defaultCenter] addObserverForName:UIApplicationDidFinishLaunchingNotification
                                                    object:nil
                                                     queue:nil
                                                usingBlock:^(NSNotification *note) {
                                                  if (note.userInfo.count > 0) {
                                                    HeroSignalRNImpl.launchOptions = note.userInfo;
                                                  }
                                                }];
}

+ (void)install
{
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    UIApplication *application = [UIApplication sharedApplication];
    id<UIApplicationDelegate> delegate = application.delegate;
    if (delegate == nil) {
      NSLog(@"[HeroSignal] AppDelegate bulunamadı; APNs token'ı otomatik iletilemiyor. "
            @"AppDelegate'ten HeroSignalRNImpl.setDeviceToken çağırın.");
      return;
    }
    Class cls = [delegate class];
    BOOL added = hs_swizzle(cls,
                            @selector(application:didRegisterForRemoteNotificationsWithDeviceToken:),
                            (IMP)hs_didRegister,
                            &hsOriginalDidRegister);
    added = hs_swizzle(cls,
                       @selector(application:didFailToRegisterForRemoteNotificationsWithError:),
                       (IMP)hs_didFail,
                       &hsOriginalDidFail) || added;
    if (added) {
      // UIApplication delegate'in yanıt verdiği yöntemleri atama anında önbelleğe alır; yeniden atama ile yenilenir.
      id<UIApplicationDelegate> strongDelegate = delegate;
      application.delegate = nil;
      application.delegate = strongDelegate;
    }
  });
}

@end
