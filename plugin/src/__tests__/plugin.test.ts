import { compileModsAsync } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import plist from '@expo/plist';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import withHeroSignal from '../index';
import { NSE_TARGET_NAME, resolveProps } from '../options';
import { planIconOutputs, resourceNameFromPath, setReplacingMetaData } from '../withHeroSignalAndroid';
import { addNseTarget, applyAppEntitlements, applyAppInfoPlist, updatePodfile } from '../withHeroSignalIos';
import type { XcodeProjectLike } from '../withHeroSignalIos';

const xcode = jest.requireActual<{ project(p: string): XcodeProjectLike & { parseSync(): void; writeSync(): string } }>('xcode');

const FIXTURE = path.join(__dirname, '__fixtures__', 'project');

// Prebuild mod'ları ve ikon üretimi (jimp) yavaştır.
jest.setTimeout(120_000);

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function readPlist(file: string): Record<string, unknown> {
  return plist.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function baseConfig(): ExpoConfig {
  return {
    name: 'HeroSignalExample',
    slug: 'herosignal-example',
    version: '1.2.3',
    ios: { bundleIdentifier: 'dev.herosignal.example', buildNumber: '42' },
    android: { package: 'dev.herosignal.example' },
  };
}

describe('saf yardımcılar', () => {
  it('ikon kaynak adları ve yoğunluk planı', () => {
    expect(resourceNameFromPath('./assets/My Bell-Icon.png')).toBe('my_bell_icon');
    expect(resourceNameFromPath('9lives.png')).toBe('hs_9lives');
    const outputs = planIconOutputs({ smallIcons: ['a/bell.png'], largeIcons: ['b/promo.png'] });
    expect(outputs.map((o) => [o.relativePath, o.size])).toEqual([
      ['drawable-mdpi/bell.png', 24],
      ['drawable-hdpi/bell.png', 36],
      ['drawable-xhdpi/bell.png', 48],
      ['drawable-xxhdpi/bell.png', 72],
      ['drawable-xxxhdpi/bell.png', 96],
      ['drawable-xxxhdpi/promo.png', 256],
    ]);
    expect(() => planIconOutputs({ smallIcons: ['a/bell.png', 'b/Bell.png'], largeIcons: [] })).toThrow(/bell/);
  });

  it('meta-data kütüphane değerini tools:replace ile ezer', () => {
    const manifest = { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' }, application: [{ $: { 'android:name': '.MainApplication' } }] } };
    setReplacingMetaData(manifest as never, 'com.herosignal.sdk.default_notification_icon', '@drawable/bell');
    setReplacingMetaData(manifest as never, 'com.herosignal.sdk.default_notification_icon', '@drawable/bell2');
    const app = (manifest.manifest.application[0] as unknown as { 'meta-data': { $: Record<string, string> }[] })['meta-data'];
    expect(app).toHaveLength(1);
    expect(app[0].$).toEqual({
      'android:name': 'com.herosignal.sdk.default_notification_icon',
      'android:resource': '@drawable/bell2',
      'tools:replace': 'android:resource',
    });
    expect((manifest.manifest.$ as Record<string, string>)['xmlns:tools']).toBe('http://schemas.android.com/tools');
  });

  it('entitlements ve Info.plist', () => {
    const props = resolveProps({ mode: 'production', appId: 'app_1', apiUrl: 'https://api.example.com' });
    expect(applyAppEntitlements({ [`com.apple.security.application-groups`]: ['group.other'] }, props, 'group.x')).toEqual({
      'aps-environment': 'production',
      'com.apple.security.application-groups': ['group.other', 'group.x'],
    });
    const info = applyAppInfoPlist({ UIBackgroundModes: ['fetch', 'remote-notification'] }, props, 'group.x');
    expect(info).toEqual({
      UIBackgroundModes: ['fetch', 'remote-notification'],
      HeroSignalAppGroup: 'group.x',
      HeroSignalAppId: 'app_1',
      HeroSignalApiUrl: 'https://api.example.com',
    });
    const noNse = resolveProps({ disableNotificationServiceExtension: true });
    expect(applyAppEntitlements({}, noNse, 'group.x')).toEqual({ 'aps-environment': 'development' });
    expect(applyAppInfoPlist({}, noNse, 'group.x')).toEqual({ UIBackgroundModes: ['remote-notification'] });
  });

  it('Podfile güncellemesi tekrar çalıştırmada değişmez', () => {
    const podfile = fs.readFileSync(path.join(FIXTURE, 'ios', 'Podfile'), 'utf8');
    const props = resolveProps({ iPhoneDeploymentTarget: '16.0' });
    const once = updatePodfile(podfile, props, '../../sdk/ios');
    const twice = updatePodfile(once, props, '../../sdk/ios');
    expect(twice).toBe(once);
    expect(once).toContain("pod 'HeroSignal', :path => '../../sdk/ios'");
    expect(once).toContain(`target '${NSE_TARGET_NAME}' do`);
    expect(once).toContain("platform :ios, '16.0'");
    expect(once).toContain("pod 'HeroSignal/Extension', :path => '../../sdk/ios'");
    // NSE bloğu ana hedefin dışında, dosya sonundadır; yerel SDK satırı ana hedefin içindedir.
    expect(once.trimEnd().endsWith('# @herosignal end herosignal-nse-target')).toBe(true);
    expect(once.indexOf("pod 'HeroSignal', :path")).toBeLessThan(once.indexOf('post_install'));
    const published = updatePodfile(podfile, resolveProps({}), null);
    expect(published).toContain("pod 'HeroSignal/Extension', '~> 0.1'");
    expect(published).not.toContain(":path => '");
  });

  it('Xcode NSE hedefi bir kez eklenir ve yapılandırılır', () => {
    const project = xcode.project(path.join(FIXTURE, 'ios', 'HeroSignalExample.xcodeproj', 'project.pbxproj'));
    project.parseSync();
    const props = resolveProps({ devTeam: 'TEAM123456', iPhoneDeploymentTarget: '15.4' });
    expect(addNseTarget(project, props, 'dev.herosignal.example')).toBe(true);
    expect(addNseTarget(project, props, 'dev.herosignal.example')).toBe(false);
    const output = project.writeSync();
    expect(output).toContain(`PRODUCT_BUNDLE_IDENTIFIER = "dev.herosignal.example.${NSE_TARGET_NAME}"`);
    expect(output).toContain(`CODE_SIGN_ENTITLEMENTS = ${NSE_TARGET_NAME}/${NSE_TARGET_NAME}.entitlements`);
    expect(output).toContain('IPHONEOS_DEPLOYMENT_TARGET = 15.4');
    expect(output).toContain('NotificationService.swift in Sources');
    expect(output).toContain(`${NSE_TARGET_NAME}.appex in Copy Files`);
    expect(output.match(/DEVELOPMENT_TEAM = TEAM123456/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

describe('config plugin (prebuild mod çıktıları)', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'herosignal-plugin-'));
    copyDir(FIXTURE, projectRoot);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('iOS: entitlements, Info.plist, NSE dosyaları, Xcode hedefi ve Podfile', async () => {
    const config = withHeroSignal(baseConfig(), { mode: 'production', devTeam: 'TEAM123456', appId: 'app_1' });
    await compileModsAsync(config, { projectRoot, platforms: ['ios'], assertMissingModProviders: false });

    const iosDir = path.join(projectRoot, 'ios');
    const entitlementsFile = fs
      .readdirSync(path.join(iosDir, 'HeroSignalExample'))
      .find((f) => f.endsWith('.entitlements'));
    expect(entitlementsFile).toBeDefined();
    const entitlements = readPlist(path.join(iosDir, 'HeroSignalExample', entitlementsFile!));
    expect(entitlements).toMatchObject({
      'aps-environment': 'production',
      'com.apple.security.application-groups': ['group.dev.herosignal.example.herosignal'],
    });

    const info = readPlist(path.join(iosDir, 'HeroSignalExample', 'Info.plist'));
    expect(info.UIBackgroundModes).toContain('remote-notification');
    expect(info.HeroSignalAppGroup).toBe('group.dev.herosignal.example.herosignal');

    const nseDir = path.join(iosDir, NSE_TARGET_NAME);
    expect(fs.readFileSync(path.join(nseDir, 'NotificationService.swift'), 'utf8')).toContain('HeroSignalNotificationServiceExtension(');
    const nseInfo = readPlist(path.join(nseDir, `${NSE_TARGET_NAME}-Info.plist`));
    expect(nseInfo).toMatchObject({
      CFBundleShortVersionString: '1.2.3',
      CFBundleVersion: '42',
      HeroSignalAppGroup: 'group.dev.herosignal.example.herosignal',
      HeroSignalAppId: 'app_1',
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.usernotifications.service' },
    });
    const nseEntitlements = readPlist(path.join(nseDir, `${NSE_TARGET_NAME}.entitlements`));
    expect(nseEntitlements).toEqual({ 'com.apple.security.application-groups': ['group.dev.herosignal.example.herosignal'] });

    const pbxproj = fs.readFileSync(path.join(iosDir, 'HeroSignalExample.xcodeproj', 'project.pbxproj'), 'utf8');
    expect(pbxproj).toContain(`productType = "com.apple.product-type.app-extension"`);
    expect(pbxproj).toContain('DEVELOPMENT_TEAM = TEAM123456');

    const podfile = fs.readFileSync(path.join(iosDir, 'Podfile'), 'utf8');
    expect(podfile).toContain(`target '${NSE_TARGET_NAME}' do`);
  });

  it('Android: ikonlar, vurgu rengi, manifest ve google-services', async () => {
    fs.writeFileSync(path.join(projectRoot, 'google-services.json'), JSON.stringify({ project_info: { project_id: 'demo' } }));
    const config = withHeroSignal(baseConfig(), {
      smallIcons: ['./assets/icon.png'],
      largeIcons: ['./assets/icon.png'],
      smallIconAccentColor: '#FF6600',
      googleServicesFile: './google-services.json',
    });
    await compileModsAsync(config, { projectRoot, platforms: ['android'], assertMissingModProviders: false });

    const res = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      expect(fs.existsSync(path.join(res, `drawable-${density}`, 'icon.png'))).toBe(true);
    }
    // Aynı dosya hem küçük hem büyük ikon: xxxhdpi'de büyük ikon (256 px) son yazılandır.
    const large = fs.readFileSync(path.join(res, 'drawable-xxxhdpi', 'icon.png'));
    expect(large.readUInt32BE(16)).toBe(256);
    const small = fs.readFileSync(path.join(res, 'drawable-mdpi', 'icon.png'));
    expect(small.readUInt32BE(16)).toBe(24);

    const colors = fs.readFileSync(path.join(res, 'values', 'colors.xml'), 'utf8');
    expect(colors).toContain('<color name="herosignal_notification_accent_color">#FF6600</color>');

    const manifest = fs.readFileSync(path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
    expect(manifest).toContain('android:name="com.herosignal.sdk.default_notification_icon" android:resource="@drawable/icon" tools:replace="android:resource"');
    expect(manifest).toContain('android:name="com.herosignal.sdk.default_notification_color" android:resource="@color/herosignal_notification_accent_color"');
    expect(manifest).toContain('android.permission.POST_NOTIFICATIONS');
    expect(manifest).toContain('xmlns:tools="http://schemas.android.com/tools"');

    expect(fs.existsSync(path.join(projectRoot, 'android', 'app', 'google-services.json'))).toBe(true);
    expect(fs.readFileSync(path.join(projectRoot, 'android', 'build.gradle'), 'utf8')).toContain('com.google.gms:google-services');
    expect(fs.readFileSync(path.join(projectRoot, 'android', 'app', 'build.gradle'), 'utf8')).toContain('com.google.gms.google-services');
  });

  it('NSE kapalıyken iOS hedefi ve App Group eklenmez', async () => {
    const config = withHeroSignal(baseConfig(), { disableNotificationServiceExtension: true });
    await compileModsAsync(config, { projectRoot, platforms: ['ios'], assertMissingModProviders: false });
    expect(fs.existsSync(path.join(projectRoot, 'ios', NSE_TARGET_NAME))).toBe(false);
    const podfile = fs.readFileSync(path.join(projectRoot, 'ios', 'Podfile'), 'utf8');
    expect(podfile).not.toContain(NSE_TARGET_NAME);
  });

  it('bundleIdentifier yoksa açıklayıcı hata verir', async () => {
    const config = withHeroSignal({ name: 'x', slug: 'x' }, {});
    await expect(compileModsAsync(config, { projectRoot, platforms: ['ios'], assertMissingModProviders: false })).rejects.toThrow(
      /bundleIdentifier/,
    );
  });
});
