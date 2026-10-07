/**
 * `xcode` (cordova-node-xcode) paketinin bu eklentide kullanılan yüzeyi için tip bildirimleri. Paket tip içermez;
 * `@expo/config-plugins` `XcodeProject` tipini bu modülden aldığından mod sonuçları da bu tiplerle çözülür.
 */
declare module 'xcode' {
  /** PBXGroup girdisi (kök grupta `name` ve `path` yoktur). */
  export interface PBXGroupEntry {
    isa?: string;
    name?: string;
    path?: string;
    children?: { value: string; comment?: string }[];
  }

  /** XCBuildConfiguration girdisi; değerler pbxproj biçiminde (gerekirse tırnaklı) metindir. */
  export interface XCBuildConfiguration {
    isa: string;
    name: string;
    buildSettings: Record<string, string | string[] | undefined>;
  }

  export interface PBXNativeTargetEntry {
    isa: string;
    name: string;
    productName?: string;
    productType?: string;
  }

  /** Bölüm sözlükleri: anahtar UUID; `<uuid>_comment` anahtarları metin değer taşır. */
  export type PBXSection<T> = Record<string, T | string>;

  export interface PBXObjects {
    PBXGroup: PBXSection<PBXGroupEntry>;
    PBXTargetDependency?: PBXSection<unknown>;
    PBXContainerItemProxy?: PBXSection<unknown>;
    [section: string]: PBXSection<unknown> | undefined;
  }

  export class XcodeProject {
    hash: { project: { objects: PBXObjects } };
    parseSync(): this;
    writeSync(options?: { omitEmptyValues?: boolean }): string;
    pbxTargetByName(name: string): PBXNativeTargetEntry | null;
    pbxNativeTargetSection(): PBXSection<PBXNativeTargetEntry>;
    pbxXCBuildConfigurationSection(): PBXSection<XCBuildConfiguration>;
    addPbxGroup(filePaths: string[], name: string, path: string, sourceTree?: string): { uuid: string; pbxGroup: PBXGroupEntry };
    addToPbxGroup(file: string, groupKey: string): void;
    addTarget(name: string, type: string, subfolder?: string, bundleId?: string): { uuid: string; pbxNativeTarget: PBXNativeTargetEntry };
    addBuildPhase(filePaths: string[], buildPhaseType: string, comment: string, target?: string): { uuid: string };
    addTargetAttribute(prop: string, value: string, target: { uuid: string }): void;
  }

  /** Proje dosyasını açar (`parseSync()` ile okunur). */
  export function project(projectPath: string): XcodeProject;
}
