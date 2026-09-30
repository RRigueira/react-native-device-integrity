import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { IntegrityScreen } from './screens/IntegrityScreen';
import { ProtectedScreen } from './screens/ProtectedScreen';

type Screen = 'home' | 'protected';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [treatEmulatorAsCompromised, setTreatEmulatorAsCompromised] =
    useState(false);
  const [androidTamperDemo, setAndroidTamperDemo] = useState(false);

  useEffect(() => {
    if (screen !== 'protected') {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setScreen('home');
        return true;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [screen]);

  return (
    <>
      <StatusBar style="dark" />
      {screen === 'home' ? (
        <IntegrityScreen
          treatEmulatorAsCompromised={treatEmulatorAsCompromised}
          onTreatEmulatorChange={setTreatEmulatorAsCompromised}
          androidTamperDemo={androidTamperDemo}
          onAndroidTamperDemoChange={setAndroidTamperDemo}
          onOpenProtected={() => setScreen('protected')}
        />
      ) : (
        <ProtectedScreen
          treatEmulatorAsCompromised={treatEmulatorAsCompromised}
          androidTamperDemo={androidTamperDemo}
          onBack={() => setScreen('home')}
        />
      )}
    </>
  );
}
