import { DEFAULT_DEPLOYMENT_TARGET, HeroSignalPluginError, normalizeColor, resolveAppGroup, resolveProps } from '../options';

describe('resolveProps', () => {
  it('varsayılanları uygular', () => {
    expect(resolveProps(undefined)).toEqual({
      mode: 'development',
      devTeam: null,
      iPhoneDeploymentTarget: DEFAULT_DEPLOYMENT_TARGET,
      smallIcons: [],
      largeIcons: [],
      smallIconAccentColor: null,
      appGroup: null,
      appId: null,
      apiUrl: null,
      disableNotificationServiceExtension: false,
      googleServicesFile: null,
      iosSdkPath: null,
    });
  });

  it('geçerli seçenekleri normalize eder', () => {
    const props = resolveProps({
      mode: 'production',
      devTeam: ' ABCDE12345 ',
      iPhoneDeploymentTarget: '16.0',
      smallIcons: ['./assets/bell.png'],
      largeIcons: ['./assets/large.png'],
      smallIconAccentColor: '#ff6600',
      appGroup: 'group.com.example.shared',
      appId: 'app_123',
      apiUrl: 'https://api.example.com',
      disableNotificationServiceExtension: true,
      googleServicesFile: './google-services.json',
      iosSdkPath: '../../sdk/ios',
    });
    expect(props.mode).toBe('production');
    expect(props.devTeam).toBe('ABCDE12345');
    expect(props.smallIconAccentColor).toBe('#FF6600');
    expect(props.disableNotificationServiceExtension).toBe(true);
    expect(resolveAppGroup(props, 'com.example')).toBe('group.com.example.shared');
  });

  it('varsayılan App Group iOS SDK kuralıyla aynıdır', () => {
    expect(resolveAppGroup(resolveProps({}), 'com.example.app')).toBe('group.com.example.app.herosignal');
  });

  it.each([
    [{ mode: 'staging' }, /mode/],
    [{ iPhoneDeploymentTarget: '14.0' }, /15\.0/],
    [{ iPhoneDeploymentTarget: 'latest' }, /15\.0/],
    [{ smallIcons: 'icon.png' }, /smallIcons/],
    [{ largeIcons: [''] }, /largeIcons/],
    [{ smallIconAccentColor: 'orange' }, /smallIconAccentColor/],
    [{ appGroup: 'com.example' }, /appGroup/],
    [{ apiUrl: 'ftp://x' }, /apiUrl/],
    [{ devTeam: '' }, /devTeam/],
  ])('geçersiz seçeneği reddeder: %j', (input, message) => {
    expect(() => resolveProps(input as never)).toThrow(HeroSignalPluginError);
    expect(() => resolveProps(input as never)).toThrow(message);
  });
});

describe('normalizeColor', () => {
  it('6 ve 8 haneli renkleri kabul eder', () => {
    expect(normalizeColor('#abcdef')).toBe('#ABCDEF');
    expect(normalizeColor('#80abcdef')).toBe('#80ABCDEF');
    expect(() => normalizeColor('abcdef')).toThrow();
  });
});
