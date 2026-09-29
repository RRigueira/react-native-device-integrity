import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';
import type { IntegrityResult } from '../types';

const mockCheckIntegrity = jest.fn<Promise<IntegrityResult>, [unknown?]>();

jest.mock('../checkIntegrity', () => ({
  checkIntegrity: (...args: unknown[]) => mockCheckIntegrity(...args),
}));

import { useDeviceIntegrity } from '../useDeviceIntegrity';

describe('useDeviceIntegrity', () => {
  let appStateHandler: ((state: AppStateStatus) => void) | undefined;
  let remove: jest.Mock;

  const cleanResult: IntegrityResult = {
    status: 'clean',
    signals: [],
    platform: 'ios',
  };

  const compromisedResult: IntegrityResult = {
    status: 'compromised',
    signals: [
      {
        id: 'jailbreak_cydia',
        category: 'jailbreak',
        description: 'Cydia',
      },
    ],
    platform: 'ios',
  };

  beforeEach(() => {
    mockCheckIntegrity.mockReset();
    remove = jest.fn();
    appStateHandler = undefined;

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler) => {
        appStateHandler = handler as (state: AppStateStatus) => void;
        return { remove } as NativeEventSubscription;
      });

    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      get: () => 'active',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts as unknown / loading with empty signals', async () => {
    let resolveCheck: (value: IntegrityResult) => void = () => {};
    mockCheckIntegrity.mockImplementation(
      () =>
        new Promise<IntegrityResult>((resolve) => {
          resolveCheck = resolve;
        })
    );

    const { result } = renderHook(() => useDeviceIntegrity());

    expect(result.current.status).toBe('unknown');
    expect(result.current.loading).toBe(true);
    expect(result.current.signals).toEqual([]);
    expect(result.current.result).toBeNull();

    await act(async () => {
      resolveCheck(cleanResult);
    });
  });

  it('resolves and exposes status / signals / result', async () => {
    mockCheckIntegrity.mockResolvedValue(compromisedResult);

    const { result } = renderHook(() => useDeviceIntegrity());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.status).toBe('compromised');
    expect(result.current.signals).toEqual(compromisedResult.signals);
    expect(result.current.result).toEqual(compromisedResult);
  });

  it('refresh re-runs the check and keeps previous result while loading', async () => {
    mockCheckIntegrity
      .mockResolvedValueOnce(cleanResult)
      .mockImplementationOnce(
        () =>
          new Promise<IntegrityResult>(() => {
            /* pending */
          })
      );

    const { result } = renderHook(() => useDeviceIntegrity());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.status).toBe('clean');

    let resolveSecond: (value: IntegrityResult) => void = () => {};
    mockCheckIntegrity.mockReset();
    mockCheckIntegrity.mockImplementation(
      () =>
        new Promise<IntegrityResult>((resolve) => {
          resolveSecond = resolve;
        })
    );

    let refreshPromise!: Promise<IntegrityResult>;
    await act(async () => {
      refreshPromise = result.current.refresh();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.result).toEqual(cleanResult);

    await act(async () => {
      resolveSecond(compromisedResult);
      await refreshPromise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.status).toBe('compromised');
  });

  it('re-checks when AppState goes background/inactive → active', async () => {
    mockCheckIntegrity.mockResolvedValue(cleanResult);

    renderHook(() => useDeviceIntegrity());

    await waitFor(() => {
      expect(mockCheckIntegrity).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      appStateHandler?.('background');
    });
    await act(async () => {
      appStateHandler?.('active');
    });

    await waitFor(() => {
      expect(mockCheckIntegrity).toHaveBeenCalledTimes(2);
    });
  });

  it('ignores stale responses from older requests', async () => {
    let resolveFirst: (value: IntegrityResult) => void = () => {};
    let resolveSecond: (value: IntegrityResult) => void = () => {};

    mockCheckIntegrity
      .mockImplementationOnce(
        () =>
          new Promise<IntegrityResult>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<IntegrityResult>((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { result } = renderHook(() => useDeviceIntegrity());

    await act(async () => {
      result.current.refresh().catch(() => undefined);
    });

    await act(async () => {
      resolveSecond(compromisedResult);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('compromised');
    });

    await act(async () => {
      resolveFirst(cleanResult);
    });

    expect(result.current.status).toBe('compromised');
    expect(result.current.result).toEqual(compromisedResult);
  });

  it('does not update state after unmount', async () => {
    let resolveCheck: (value: IntegrityResult) => void = () => {};
    mockCheckIntegrity.mockImplementation(
      () =>
        new Promise<IntegrityResult>((resolve) => {
          resolveCheck = resolve;
        })
    );

    const { result, unmount } = renderHook(() => useDeviceIntegrity());

    expect(result.current.loading).toBe(true);
    unmount();

    await act(async () => {
      resolveCheck(cleanResult);
    });

    // After unmount, React Testing Library keeps the last snapshot; we assert
    // it was never updated to the resolved clean result.
    expect(result.current.result).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});
