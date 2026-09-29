import { TurboModuleRegistry, type TurboModule } from 'react-native';

export type NativeSignal = {
  id: string;
  category: string;
  description: string;
};

export type NativeIntegrityReport = {
  completed: boolean;
  reason?: string;
  signals: NativeSignal[];
};

export interface Spec extends TurboModule {
  checkIntegrity(): Promise<NativeIntegrityReport>;
}

export default TurboModuleRegistry.get<Spec>('DeviceIntegrity');
