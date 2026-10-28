import {NativeModules} from 'react-native';

type SavedConnection = {code: string};
type ConnectionModule = {
  load(): Promise<SavedConnection>;
  save(code: string): Promise<void>;
  clear(): Promise<void>;
};

const nativeConnection = (): ConnectionModule | undefined => NativeModules.SrdConnection as ConnectionModule | undefined;

export const connectionStore = {
  load: (): Promise<SavedConnection> => nativeConnection()?.load() ?? Promise.resolve({code: ''}),
  save: (code: string): Promise<void> => nativeConnection()?.save(code) ?? Promise.resolve(),
  clear: (): Promise<void> => nativeConnection()?.clear() ?? Promise.resolve(),
};
