import type { TurboModule } from 'react-native';
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
  /** Signal ids the app configured at build time as reported-only (Android). */
  reportOnly?: string[];
};

export interface Spec extends TurboModule {
  // `Object` (not CodegenTypes.UnsafeObject) so older codegen versions, e.g.
  // React Native 0.79, can parse the spec. Codegen maps it to a generic object.
  checkIntegrity(options: Object): Promise<NativeIntegrityReport>;
}

export default TurboModuleRegistry.get<Spec>('DeviceIntegrity');
