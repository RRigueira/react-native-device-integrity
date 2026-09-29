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

describe('package exports', () => {
  it('exports exactly checkIntegrity and useDeviceIntegrity', () => {
    expect(Object.keys(DeviceIntegrity).sort()).toEqual([
      'checkIntegrity',
      'useDeviceIntegrity',
    ]);
    expect(typeof DeviceIntegrity.checkIntegrity).toBe('function');
    expect(typeof DeviceIntegrity.useDeviceIntegrity).toBe('function');
  });
});
