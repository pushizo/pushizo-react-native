package com.herosignal.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Autolinking ile uygulamaya eklenen paket; yeni mimaride modül TurboModule olarak kaydedilir. */
class HeroSignalPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == HeroSignalModule.NAME) HeroSignalModule(reactContext) else null

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        mapOf(
            HeroSignalModule.NAME to ReactModuleInfo(
                HeroSignalModule.NAME,
                HeroSignalModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, // isTurboModule
            ),
        )
    }
}
