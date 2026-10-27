import {srdThemes} from './theme';

describe('SRD mobile theme tokens', () => {
  it('matches the web light palette and controls', () => {
    const {colors, radius, typography} = srdThemes.light;
    expect(colors).toMatchObject({
      accent: '#245bce', accentSoft: '#e7edfa', background: '#f5f7fb', surface: '#fff', surfaceSoft: '#f0f4fa',
      ink: '#1c2e49', muted: '#5e6e85', border: '#dfe5ee', placeholder: '#7e8ca1',
    });
    expect(colors).toMatchObject({error: '#912035', errorSoft: '#fff0f1', errorBorder: '#edb2ba'});
    expect(radius).toEqual({control: 8, card: 11, panel: 12});
    expect(typography).toMatchObject({family: 'PublicSans', body: 15, small: 12, title: 30, heading: 19});
  });

  it('matches the web dark palette while preserving the SRD accent', () => {
    expect(srdThemes.dark.colors).toMatchObject({
      accent: '#245bce', accentSoft: '#1a2b48', background: '#111a28', surface: '#192537', surfaceSoft: '#223149',
      ink: '#e5ecf7', muted: '#adbcd1', border: '#34445c',
    });
    expect(srdThemes.dark.mode).toBe('dark');
  });
});
