package com.herosignal.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Otomatik bağlama (autolinking) ile uygulamaya eklenen paket; yeni ve eski mimaride aynı modül adını (`HeroSignal`) sunar. */
class HeroSignalPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == HeroSignalModuleImpl.NAME) HeroSignalModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            HeroSignalModuleImpl.NAME to ReactModuleInfo(
                HeroSignalModuleImpl.NAME,
                HeroSignalModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, // isTurboModule
            ),
        )
    }
}
