import { TurboModuleRegistry, type TurboModule } from 'react-native';

// Integrity API methods are added in Phase 1 (codegen accepts empty module specs).
export interface Spec extends TurboModule {}

export default TurboModuleRegistry.getEnforcing<Spec>('DeviceIntegrity');
