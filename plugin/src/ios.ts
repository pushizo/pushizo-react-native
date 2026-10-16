import {
  CodeGenerator,
  type ConfigPlugin,
  type XcodeProject,
  withAppDelegate,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import * as fs from 'fs';
import * as path from 'path';
import type { ResolvedProps } from './props';

export const NSE_TARGET = 'PushizoNotificationServiceExtension';
export const NSE_FILES = ['NotificationService.swift', 'Info.plist', `${NSE_TARGET}.entitlements`] as const;
export const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates', NSE_TARGET);

/** Yerel SDK ve köprünün okuduğu Info.plist anahtarları. */
export const PLIST = {
  appId: 'PushizoAppId',
  apiUrl: 'PushizoApiUrl',
  appGroup: 'PushizoAppGroup',
  requiresConsent: 'PushizoRequiresPrivacyConsent',
  logLevel: 'PushizoLogLevel',
} as const;

/** iOS SDK `Pushizo.Location.requestPermission` bu anahtar yoksa izin istemez (false döner). */
export const LOCATION_USAGE_KEY = 'NSLocationWhenInUseUsageDescription';

type Plist = Record<string, unknown>;

/** Plist dizisindeki metin öğeleri (beklenmeyen tipler atlanır). */
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function requireBundleId(config: ExpoConfig): string {
  const bundleId = config.ios?.bundleIdentifier;
  if (!bundleId) {
    throw new Error('@pushizo/react-native config plugin: app.json → "ios.bundleIdentifier" gerekli (App Group ve NSE kimliği için).');
  }
  return bundleId;
}

/** SDK kuralı: App Group verilmezse `group.<bundle id>.pushizo`. */
export function resolveAppGroup(props: ResolvedProps, bundleId: string): string {
  return props.iosAppGroup ?? `group.${bundleId}.pushizo`;
}

export function applyEntitlements<T extends object>(entitlements: T, props: ResolvedProps, appGroup: string): T {
  const e = entitlements as Plist;
  e['aps-environment'] = props.mode;
  const groups = stringArray(e['com.apple.security.application-groups']);
  if (!groups.includes(appGroup)) groups.push(appGroup);
  e['com.apple.security.application-groups'] = groups;
  return entitlements;
}

export function applyInfoPlist<T extends object>(infoPlist: T, props: ResolvedProps, appGroup: string): T {
  const p = infoPlist as Plist;
  const modes = stringArray(p.UIBackgroundModes);
  if (!modes.includes('remote-notification')) modes.push('remote-notification');
  p.UIBackgroundModes = modes;
  p[PLIST.appGroup] = appGroup;
  if (props.appId) p[PLIST.appId] = props.appId;
  else delete p[PLIST.appId];
  if (props.apiUrl) p[PLIST.apiUrl] = props.apiUrl;
  else delete p[PLIST.apiUrl];
  // Erken başlatma (köprü `+load`) bu anahtarları okur: onay bayrağı olmadan SDK onaydan önce ağa çıkabilirdi.
  if (props.appId) p[PLIST.requiresConsent] = props.requiresPrivacyConsent === true;
  else delete p[PLIST.requiresConsent];
  if (props.appId && props.logLevel) p[PLIST.logLevel] = props.logLevel;
  else delete p[PLIST.logLevel];
  // Konum açıklaması isteğe bağlıdır; verilmezse uygulamanın kendi yazdığı değer korunur (silinmez).
  if (props.iosLocationUsageDescription) p[LOCATION_USAGE_KEY] = props.iosLocationUsageDescription;
  return infoPlist;
}

const SWIFT_EXPO_METHODS = `  // APNs token'ı Pushizo'ya iletilir (SDK swizzling kullanmaz).
  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Pushizo.setDeviceToken(deviceToken)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    Pushizo.setDeviceTokenError(error)
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }`;

const SWIFT_PLAIN_METHODS = `  // APNs token'ı Pushizo'ya iletilir (SDK swizzling kullanmaz).
  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Pushizo.setDeviceToken(deviceToken)
  }

  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    Pushizo.setDeviceTokenError(error)
  }`;

/**
 * AppDelegate'e APNs token iletimini ekler. Swift (Expo SDK 53+ / RN 0.77+ şablonu) ve Objective-C(++) AppDelegate
 * desteklenir; aynı içerik ikinci kez eklenmez. Uygulama delegesi zaten bu metotları tanımlıyorsa açık hata verilir.
 */
export function applyAppDelegate(contents: string, language: string): string {
  if (language === 'swift') {
    let src = CodeGenerator.mergeContents({
      src: contents,
      newSrc: 'import Pushizo',
      tag: 'pushizo-import',
      anchor: /^import /m,
      offset: 0,
      comment: '//',
    }).contents;
    const withoutOurs = CodeGenerator.removeGeneratedContents(src, 'pushizo-apns') ?? src;
    if (/didRegisterForRemoteNotificationsWithDeviceToken/.test(withoutOurs)) {
      throw new Error(
        "@pushizo/react-native config plugin: AppDelegate zaten didRegisterForRemoteNotificationsWithDeviceToken tanımlıyor. Bu metoda `Pushizo.setDeviceToken(deviceToken)` satırını elle ekleyin.",
      );
    }
    const isExpo = /class\s+AppDelegate\s*:\s*ExpoAppDelegate/.test(src);
    const classLine = /^(public\s+)?class\s+AppDelegate\b[^{]*\{/m;
    if (!classLine.test(src)) {
      throw new Error('@pushizo/react-native config plugin: AppDelegate.swift içinde "class AppDelegate" bulunamadı.');
    }
    src = CodeGenerator.mergeContents({
      src,
      newSrc: isExpo ? SWIFT_EXPO_METHODS : SWIFT_PLAIN_METHODS,
      tag: 'pushizo-apns',
      anchor: classLine,
      offset: 1,
      comment: '//',
    }).contents;
    return src;
  }

  if (language === 'objc' || language === 'objcpp') {
    let src = CodeGenerator.mergeContents({
      src: contents,
      newSrc: '#import <PushizoReactNative/PushizoRNPush.h>',
      tag: 'pushizo-import',
      anchor: /#import "AppDelegate.h"/,
      offset: 1,
      comment: '//',
    }).contents;
    src = insertIntoObjcMethod(src, 'didRegisterForRemoteNotificationsWithDeviceToken:', 'pushizo-apns-token',
      '  [PushizoRNPush didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];',
      [
        '- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken',
        '{',
        '  [PushizoRNPush didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];',
        '  [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];',
        '}',
      ].join('\n'));
    src = insertIntoObjcMethod(src, 'didFailToRegisterForRemoteNotificationsWithError:', 'pushizo-apns-error',
      '  [PushizoRNPush didFailToRegisterForRemoteNotificationsWithError:error];',
      [
        '- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error',
        '{',
        '  [PushizoRNPush didFailToRegisterForRemoteNotificationsWithError:error];',
        '  [super application:application didFailToRegisterForRemoteNotificationsWithError:error];',
        '}',
      ].join('\n'));
    return src;
  }

  throw new Error(`@pushizo/react-native config plugin: desteklenmeyen AppDelegate dili: ${language}`);
}

/**
 * Objective-C AppDelegate: metot varsa gövdesinin başına satır ekler, yoksa metodu `@end` öncesine ekler. Eklenen blok
 * `@generated` işaretleriyle sarılır; tekrar çalıştırmada önce eski blok kaldırılır (idempotent).
 */
function insertIntoObjcMethod(src: string, selectorPart: string, tag: string, line: string, method: string): string {
  const base = CodeGenerator.removeGeneratedContents(src, tag) ?? src;
  const lines = base.split('\n');
  const wrap = (body: string) => [`// @generated begin ${tag} - expo prebuild (DO NOT MODIFY)`, ...body.split('\n'), `// @generated end ${tag}`];
  const signature = lines.findIndex((l) => /^-\s*\(void\)\s*application:/.test(l) && l.includes(selectorPart));
  if (signature >= 0) {
    const brace = lines.findIndex((l, i) => i >= signature && l.includes('{'));
    if (brace < 0) throw new Error(`@pushizo/react-native config plugin: AppDelegate ${selectorPart} gövdesi bulunamadı.`);
    lines.splice(brace + 1, 0, ...wrap(line));
    return lines.join('\n');
  }
  const end = lines.map((l) => l.trim()).lastIndexOf('@end');
  if (end < 0) throw new Error('@pushizo/react-native config plugin: AppDelegate içinde @end bulunamadı.');
  lines.splice(end, 0, ...wrap(method));
  return lines.join('\n');
}

/** Podfile: NSE hedefi (Pushizo/Extension) ve isteğe bağlı monorepo `:path`. */
export function applyPodfile(contents: string, props: ResolvedProps): string {
  let src = contents;
  const source = props.iosSdkPath ? `, :path => '${props.iosSdkPath}'` : `, '~> 0.1'`;
  if (props.iosSdkPath) {
    src = CodeGenerator.mergeContents({
      src,
      newSrc: `  pod 'Pushizo'${source}`,
      tag: 'pushizo-sdk',
      anchor: /use_native_modules!|use_expo_modules!/,
      offset: 1,
      comment: '#',
    }).contents;
  }
  if (props.iosNotificationServiceExtension) {
    const block = [`target '${NSE_TARGET}' do`, `  pod 'Pushizo/Extension'${source}`, 'end'].join('\n');
    const removed = CodeGenerator.removeGeneratedContents(src, 'pushizo-nse') ?? src;
    src = `${removed.trimEnd()}\n\n# @generated begin pushizo-nse - expo prebuild (DO NOT MODIFY)\n${block}\n# @generated end pushizo-nse\n`;
  } else {
    src = CodeGenerator.removeGeneratedContents(src, 'pushizo-nse') ?? src;
  }
  return src;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** NSE Info.plist: şablon + Pushizo anahtarları. */
export function buildNseInfoPlist(template: string, props: ResolvedProps, appGroup: string): string {
  const entries: [string, string][] = [[PLIST.appId, props.appId ?? '']];
  if (props.apiUrl) entries.push([PLIST.apiUrl, props.apiUrl]);
  entries.push([PLIST.appGroup, appGroup]);
  const keys = entries.map(([k, v]) => `\t<key>${k}</key>\n\t<string>${escapeXml(v)}</string>`).join('\n');
  const end = template.lastIndexOf('</dict>');
  if (end < 0) throw new Error('@pushizo/react-native config plugin: NSE Info.plist şablonu bozuk.');
  return `${template.slice(0, end)}${keys}\n${template.slice(end)}`;
}

export function buildNseEntitlements(appGroup: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '\t<key>com.apple.security.application-groups</key>',
    '\t<array>',
    `\t\t<string>${escapeXml(appGroup)}</string>`,
    '\t</array>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

/** NSE dosyalarını `ios/PushizoNotificationServiceExtension/` altına yazar. */
export function writeNseFiles(platformProjectRoot: string, props: ResolvedProps, appGroup: string): void {
  const dir = path.join(platformProjectRoot, NSE_TARGET);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(TEMPLATES_DIR, 'NotificationService.swift'), path.join(dir, 'NotificationService.swift'));
  const template = fs.readFileSync(path.join(TEMPLATES_DIR, 'Info.plist'), 'utf8');
  fs.writeFileSync(path.join(dir, 'Info.plist'), buildNseInfoPlist(template, props, appGroup));
  fs.writeFileSync(path.join(dir, `${NSE_TARGET}.entitlements`), buildNseEntitlements(appGroup));
}

/** Xcode projesine NSE hedefini ekler (idempotent). */
export function addNseTarget(
  project: XcodeProject,
  options: { bundleId: string; deploymentTarget: string; devTeam?: string; version: string; buildNumber: string },
): XcodeProject {
  // xcode kütüphanesi eklediği hedef adını tırnaklı saklar; her iki biçim de kontrol edilir.
  if (project.pbxTargetByName(NSE_TARGET) || project.pbxTargetByName(`"${NSE_TARGET}"`)) return project;

  // Hiç uzantı içermeyen projelerde bu bölümler yoktur; xcode kütüphanesi bağımlılık eklerken bunları bekler.
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency = objects.PBXTargetDependency ?? {};
  objects.PBXContainerItemProxy = objects.PBXContainerItemProxy ?? {};

  const group = project.addPbxGroup([...NSE_FILES], NSE_TARGET, NSE_TARGET);
  const groups = objects.PBXGroup;
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    if (typeof g === 'object' && g.name === undefined && g.path === undefined) project.addToPbxGroup(group.uuid, key);
  }

  const target = project.addTarget(NSE_TARGET, 'app_extension', NSE_TARGET, `${options.bundleId}.${NSE_TARGET}`);
  project.addBuildPhase(['NotificationService.swift'], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

  const configurations = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configurations)) {
    const cfg = configurations[key];
    if (typeof cfg !== 'object' || cfg.buildSettings.PRODUCT_NAME !== `"${NSE_TARGET}"`) continue;
    const settings = cfg.buildSettings;
    settings.INFOPLIST_FILE = `${NSE_TARGET}/Info.plist`;
    settings.CODE_SIGN_ENTITLEMENTS = `${NSE_TARGET}/${NSE_TARGET}.entitlements`;
    settings.CODE_SIGN_STYLE = 'Automatic';
    settings.IPHONEOS_DEPLOYMENT_TARGET = options.deploymentTarget;
    settings.TARGETED_DEVICE_FAMILY = '"1,2"';
    settings.SWIFT_VERSION = '5.0';
    settings.MARKETING_VERSION = options.version;
    settings.CURRENT_PROJECT_VERSION = options.buildNumber;
    if (options.devTeam) settings.DEVELOPMENT_TEAM = options.devTeam;
  }
  if (options.devTeam) project.addTargetAttribute('DevelopmentTeam', options.devTeam, { uuid: target.uuid });
  return project;
}

export const withPushizoIos: ConfigPlugin<ResolvedProps> = (config, props) => {
  const bundleId = requireBundleId(config);
  const appGroup = resolveAppGroup(props, bundleId);

  config = withEntitlementsPlist(config, (c) => {
    c.modResults = applyEntitlements(c.modResults, props, appGroup);
    return c;
  });

  config = withInfoPlist(config, (c) => {
    c.modResults = applyInfoPlist(c.modResults, props, appGroup);
    return c;
  });

  config = withAppDelegate(config, (c) => {
    c.modResults.contents = applyAppDelegate(c.modResults.contents, c.modResults.language);
    return c;
  });

  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      const podfile = path.join(c.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');
      fs.writeFileSync(podfile, applyPodfile(contents, props));
      if (props.iosNotificationServiceExtension) writeNseFiles(c.modRequest.platformProjectRoot, props, appGroup);
      return c;
    },
  ]);

  if (props.iosNotificationServiceExtension) {
    config = withXcodeProject(config, (c) => {
      c.modResults = addNseTarget(c.modResults, {
        bundleId,
        deploymentTarget: props.iosDeploymentTarget,
        devTeam: props.devTeam,
        version: c.version ?? '1.0.0',
        buildNumber: c.ios?.buildNumber ?? '1',
      });
      return c;
    });
  }

  return config;
};
