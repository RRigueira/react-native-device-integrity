jest.mock('../NativeDeviceIntegrity', () => ({
  __esModule: true,
  default: {
    checkIntegrity: jest.fn(async () => ({
      completed: true,
      signals: [],
    })),
  },
}));

import * as DeviceIntegrity from '../index';
import { SIGNAL_IDS } from '../types';

describe('package exports', () => {
  it('exports checkIntegrity, useDeviceIntegrity, and SIGNAL_IDS', () => {
    expect(Object.keys(DeviceIntegrity).sort()).toEqual([
      'SIGNAL_IDS',
      'checkIntegrity',
      'useDeviceIntegrity',
    ]);
    expect(typeof DeviceIntegrity.checkIntegrity).toBe('function');
    expect(typeof DeviceIntegrity.useDeviceIntegrity).toBe('function');
    expect(DeviceIntegrity.SIGNAL_IDS).toEqual(SIGNAL_IDS);
  });
});
