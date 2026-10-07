// HeroSignal React Native modülü (ObjC++ kabuğu). Gövde: HeroSignalRNBridge.swift.
#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNHeroSignalSpec/RNHeroSignalSpec.h>

@interface HeroSignalRN : RCTEventEmitter <NativeHeroSignalSpec>
@end

#else
#import <React/RCTBridgeModule.h>

@interface HeroSignalRN : RCTEventEmitter <RCTBridgeModule>
@end

#endif
