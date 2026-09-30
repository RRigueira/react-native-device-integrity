import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

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
  checkIntegrity(
    options: CodegenTypes.UnsafeObject
  ): Promise<NativeIntegrityReport>;
}

export default TurboModuleRegistry.get<Spec>('DeviceIntegrity');
