# react-native-device-integrity

Jailbreak, root, hooking, debugger and tamper detection for React Native and Expo

## Installation

```sh
npm install react-native-device-integrity
```

### Expo

```sh
npx expo install react-native-device-integrity
```

Add the config plugin to `app.json` / `app.config.js`:

```json
{
  "expo": {
    "plugins": ["react-native-device-integrity"]
  }
}
```

Then run `npx expo prebuild` or use a development build. Expo Go is not supported (native module).

### Bare React Native

On iOS, add these schemes to `Info.plist` under `LSApplicationQueriesSchemes` so jailbreak URL checks can call `canOpenURL`:

`cydia`, `sileo`, `zbra`, `filza`, `undecimus`, `activator`

Android needs no extra setup — the library manifest `<queries>` merge automatically.

## Usage

```ts
import {
  checkIntegrity,
  useDeviceIntegrity,
} from 'react-native-device-integrity';

// One-shot check
const result = await checkIntegrity({
  treatEmulatorAsCompromised: false,
  timeoutMs: 10_000,
});
// result.status: 'clean' | 'compromised' | 'unknown'

// React hook (re-checks when the app returns to foreground)
function Screen() {
  const { status, signals, loading, refresh, result } = useDeviceIntegrity();
  // ...
}
```

### Result semantics

`unknown` is never treated as `clean`. It covers unsupported platforms, a missing native module, native errors, timeouts, and incomplete runs. Where integrity matters, apps should **fail closed** on `unknown` (block or degrade) rather than assuming the device is safe.


## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
