// Pushizo React Native modülü (ObjC++ kabuğu). Gövde: PushizoRNBridge.swift.
#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNPushizoSpec/RNPushizoSpec.h>

@interface PushizoRN : RCTEventEmitter <NativePushizoSpec>
@end

#else
#import <React/RCTBridgeModule.h>

@interface PushizoRN : RCTEventEmitter <RCTBridgeModule>
@end

#endif
