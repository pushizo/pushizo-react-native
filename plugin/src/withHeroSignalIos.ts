import {
  CodeGenerator,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';
import plist from '@expo/plist';
import * as fs from 'fs';
import * as path from 'path';
import type { ResolvedHeroSignalPluginProps } from './options';
import { HeroSignalPluginError, NSE_TARGET_NAME, resolveAppGroup } from './options';

export const APP_GROUPS_KEY = 'com.apple.security.application-groups';
const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates', 'ios');
const NSE_SOURCE_FILE = 'NotificationService.swift';
const NSE_INFO_PLIST = `${NSE_TARGET_NAME}-Info.plist`;
const NSE_ENTITLEMENTS = `${NSE_TARGET_NAME}.entitlements`;
const PODFILE_TAG_NSE = 'herosignal-nse-target';
const PODFILE_TAG_SDK = 'herosignal-ios-sdk-path';

function bundleIdentifierOrThrow(config: { ios?: { bundleIdentifier?: string } }): string {
  const id = config.ios?.bundleIdentifier;
  if (!id) throw new HeroSignalPluginError('ios.bundleIdentifier tanımlı olmalı (NSE ve App Group için gerekli).');
  return id;
}

// --- Saf yardımcılar (birim testli) ---

type PlistObject = Record<string, unknown>;

/** Uygulama entitlements: APNs ortamı ve (NSE etkinse) App Group. */
export function applyAppEntitlements(entitlements: PlistObject, props: ResolvedHeroSignalPluginProps, appGroup: string): PlistObject {
  const next: PlistObject = { ...entitlements, 'aps-environment': props.mode };
  if (!props.disableNotificationServiceExtension) {
    const groups = Array.isArray(entitlements[APP_GROUPS_KEY]) ? (entitlements[APP_GROUPS_KEY] as string[]) : [];
    next[APP_GROUPS_KEY] = groups.includes(appGroup) ? groups : [...groups, appGroup];
  }
  return next;
}

/** Uygulama Info.plist: arka plan bildirimleri ve SDK yapılandırma anahtarları. */
export function applyAppInfoPlist(info: PlistObject, props: ResolvedHeroSignalPluginProps, appGroup: string): PlistObject {
  const modes = Array.isArray(info.UIBackgroundModes) ? (info.UIBackgroundModes as string[]) : [];
  const next: PlistObject = {
    ...info,
    UIBackgroundModes: modes.includes('remote-notification') ? modes : [...modes, 'remote-notification'],
  };
  if (!props.disableNotificationServiceExtension) next.HeroSignalAppGroup = appGroup;
  if (props.appId) next.HeroSignalAppId = props.appId;
  if (props.apiUrl) next.HeroSignalApiUrl = props.apiUrl;
  return next;
}

/** NSE Info.plist: şablon + sürüm ve HeroSignal anahtarları. */
export function buildNseInfoPlist(
  template: PlistObject,
  props: ResolvedHeroSignalPluginProps,
  appGroup: string,
  versions: { shortVersion: string; buildNumber: string },
): PlistObject {
  const next: PlistObject = {
    ...template,
    CFBundleShortVersionString: versions.shortVersion,
    CFBundleVersion: versions.buildNumber,
    HeroSignalAppGroup: appGroup,
  };
  if (props.appId) next.HeroSignalAppId = props.appId;
  if (props.apiUrl) next.HeroSignalApiUrl = props.apiUrl;
  return next;
}

/** Podfile'a NSE hedefini (ve istenirse yerel SDK yolunu) ekler; tekrar çalıştırmada değişiklik yapmaz. */
export function updatePodfile(contents: string, props: ResolvedHeroSignalPluginProps, sdkRelativePath: string | null): string {
  let src = contents;
  if (sdkRelativePath) {
    try {
      src = CodeGenerator.mergeContents({
        src,
        newSrc: `  pod 'HeroSignal', :path => '${sdkRelativePath}'`,
        tag: PODFILE_TAG_SDK,
        anchor: /use_native_modules!/,
        offset: 1,
        comment: '#',
      }).contents;
    } catch {
      throw new HeroSignalPluginError("Podfile'da use_native_modules! satırı bulunamadı; iosSdkPath uygulanamadı.");
    }
  }
  if (!props.disableNotificationServiceExtension) {
    const podLine = sdkRelativePath
      ? `  pod 'HeroSignal/Extension', :path => '${sdkRelativePath}'`
      : `  pod 'HeroSignal/Extension', '~> 0.1'`;
    const block = [
      `target '${NSE_TARGET_NAME}' do`,
      `  platform :ios, '${props.iPhoneDeploymentTarget}'`,
      "  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if defined?(podfile_properties) && podfile_properties['ios.useFrameworks']",
      "  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']",
      podLine,
      'end',
    ].join('\n');
    // Blok dosya sonunda, ana hedef bloğunun dışında durur; önceki sürümü değiştirilir.
    const begin = `# @herosignal begin ${PODFILE_TAG_NSE}`;
    const end = `# @herosignal end ${PODFILE_TAG_NSE}`;
    const start = src.indexOf(begin);
    if (start >= 0) {
      const stop = src.indexOf(end, start);
      if (stop < 0) throw new HeroSignalPluginError(`Podfile'daki "${begin}" bloğunun sonu bulunamadı.`);
      src = src.slice(0, start) + src.slice(stop + end.length);
    }
    src = `${src.trimEnd()}\n\n${begin}\n${block}\n${end}\n`;
  }
  return src;
}

// --- Xcode projesi ---

interface XcodeBuildConfiguration {
  buildSettings?: Record<string, unknown>;
}

/** `xcode` paketinin kullanılan yüzeyi (tip bildirimi pakette yok). */
export interface XcodeProjectLike {
  hash: { project: { objects: Record<string, Record<string, unknown> | undefined> } };
  pbxTargetByName(name: string): unknown;
  addPbxGroup(files: string[], name: string, path: string): { uuid: string };
  addToPbxGroup(file: string, groupKey: string): void;
  addTarget(name: string, type: string, subfolder: string, bundleId: string): { uuid: string };
  addBuildPhase(files: string[], type: string, comment: string, target: string): unknown;
  pbxXCBuildConfigurationSection(): Record<string, XcodeBuildConfiguration | string>;
  addTargetAttribute(prop: string, value: unknown, target?: unknown): void;
  getFirstTarget(): { uuid: string; firstTarget: { buildConfigurationList: string } };
  pbxXCConfigurationList(): Record<string, { buildConfigurations?: { value: string }[] } | string>;
}

/** NSE hedefini Xcode projesine ekler (varsa dokunmaz); devTeam ana hedefe de yazılır. */
export function addNseTarget(project: XcodeProjectLike, props: ResolvedHeroSignalPluginProps, bundleIdentifier: string): boolean {
  if (props.devTeam) setMainTargetTeam(project, props.devTeam);
  // `xcode` yeni eklenen hedef adını tırnaklı saklar; ayrıştırılmış projede tırnaksızdır.
  if (project.pbxTargetByName(NSE_TARGET_NAME) || project.pbxTargetByName(`"${NSE_TARGET_NAME}"`)) return false;

  const group = project.addPbxGroup([NSE_SOURCE_FILE, NSE_INFO_PLIST, NSE_ENTITLEMENTS], NSE_TARGET_NAME, NSE_TARGET_NAME);
  // Grubu projenin kök grubuna ekler (adı ve yolu olmayan grup).
  const groups = project.hash.project.objects.PBXGroup ?? {};
  for (const key of Object.keys(groups)) {
    const value = groups[key] as { name?: string; path?: string } | string;
    if (typeof value === 'object' && value.name === undefined && value.path === undefined) {
      project.addToPbxGroup(group.uuid, key);
    }
  }

  // `xcode` paketi bu bölümler yoksa hedef bağımlılığı eklerken hata verir.
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency = objects.PBXTargetDependency ?? {};
  objects.PBXContainerItemProxy = objects.PBXContainerItemProxy ?? {};

  const target = project.addTarget(NSE_TARGET_NAME, 'app_extension', NSE_TARGET_NAME, `${bundleIdentifier}.${NSE_TARGET_NAME}`);
  project.addBuildPhase([NSE_SOURCE_FILE], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

  const configurations = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configurations)) {
    const configuration = configurations[key];
    if (typeof configuration !== 'object' || !configuration.buildSettings) continue;
    const settings = configuration.buildSettings;
    if (settings.PRODUCT_NAME !== `"${NSE_TARGET_NAME}"`) continue;
    if (props.devTeam) settings.DEVELOPMENT_TEAM = props.devTeam;
    settings.IPHONEOS_DEPLOYMENT_TARGET = props.iPhoneDeploymentTarget;
    settings.TARGETED_DEVICE_FAMILY = '"1,2"';
    settings.CODE_SIGN_ENTITLEMENTS = `${NSE_TARGET_NAME}/${NSE_ENTITLEMENTS}`;
    settings.CODE_SIGN_STYLE = 'Automatic';
    settings.SWIFT_VERSION = '5.0';
    settings.GENERATE_INFOPLIST_FILE = 'NO';
  }
  if (props.devTeam) project.addTargetAttribute('DevelopmentTeam', props.devTeam, target);
  return true;
}

function setMainTargetTeam(project: XcodeProjectLike, devTeam: string): void {
  const main = project.getFirstTarget();
  project.addTargetAttribute('DevelopmentTeam', devTeam);
  const list = project.pbxXCConfigurationList()[main.firstTarget.buildConfigurationList];
  if (typeof list !== 'object') return;
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const ref of list.buildConfigurations ?? []) {
    const configuration = configurations[ref.value];
    if (typeof configuration === 'object' && configuration.buildSettings) configuration.buildSettings.DEVELOPMENT_TEAM = devTeam;
  }
}

/** `withXcodeProject` sonucu `xcode` paketinin (tip bildirimsiz) proje nesnesidir. */
function asXcodeProject(value: unknown): XcodeProjectLike {
  return value as XcodeProjectLike;
}

// --- Config plugin'leri ---

const withAppEntitlements: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) =>
  withEntitlementsPlist(config, (cfg) => {
    cfg.modResults = applyAppEntitlements(cfg.modResults, props, resolveAppGroup(props, bundleIdentifierOrThrow(cfg))) as typeof cfg.modResults;
    return cfg;
  });

const withAppInfoPlist: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults = applyAppInfoPlist(cfg.modResults, props, resolveAppGroup(props, bundleIdentifierOrThrow(cfg))) as typeof cfg.modResults;
    return cfg;
  });

/** NSE kaynak, Info.plist ve entitlements dosyalarını `ios/HeroSignalNotificationServiceExtension/` altına yazar. */
const withNseFiles: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const bundleIdentifier = bundleIdentifierOrThrow(cfg);
      const appGroup = resolveAppGroup(props, bundleIdentifier);
      const dir = path.join(cfg.modRequest.platformProjectRoot, NSE_TARGET_NAME);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.copyFile(path.join(TEMPLATES_DIR, NSE_SOURCE_FILE), path.join(dir, NSE_SOURCE_FILE));
      const template = plist.parse(await fs.promises.readFile(path.join(TEMPLATES_DIR, 'Info.plist'), 'utf8')) as PlistObject;
      const info = buildNseInfoPlist(template, props, appGroup, {
        shortVersion: cfg.version ?? '1.0.0',
        buildNumber: cfg.ios?.buildNumber ?? '1',
      });
      await fs.promises.writeFile(path.join(dir, NSE_INFO_PLIST), plist.build(info));
      await fs.promises.writeFile(path.join(dir, NSE_ENTITLEMENTS), plist.build({ [APP_GROUPS_KEY]: [appGroup] }));
      return cfg;
    },
  ]);

const withNseXcodeTarget: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) =>
  withXcodeProject(config, (cfg) => {
    addNseTarget(asXcodeProject(cfg.modResults), props, bundleIdentifierOrThrow(cfg));
    return cfg;
  });

const withMainTargetTeam: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) =>
  withXcodeProject(config, (cfg) => {
    if (props.devTeam) setMainTargetTeam(asXcodeProject(cfg.modResults), props.devTeam);
    return cfg;
  });

const withPodfileTargets: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) throw new HeroSignalPluginError(`Podfile bulunamadı: ${podfilePath}`);
      const sdkRelativePath = props.iosSdkPath
        ? path
            .relative(cfg.modRequest.platformProjectRoot, path.resolve(cfg.modRequest.projectRoot, props.iosSdkPath))
            .split(path.sep)
            .join('/')
        : null;
      const contents = await fs.promises.readFile(podfilePath, 'utf8');
      const updated = updatePodfile(contents, props, sdkRelativePath);
      if (updated !== contents) await fs.promises.writeFile(podfilePath, updated);
      return cfg;
    },
  ]);

export const withHeroSignalIos: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) => {
  config = withAppEntitlements(config, props);
  config = withAppInfoPlist(config, props);
  if (!props.disableNotificationServiceExtension) {
    config = withNseFiles(config, props);
    config = withNseXcodeTarget(config, props);
  } else if (props.devTeam) {
    config = withMainTargetTeam(config, props);
  }
  if (!props.disableNotificationServiceExtension || props.iosSdkPath) {
    config = withPodfileTargets(config, props);
  }
  return config;
};
