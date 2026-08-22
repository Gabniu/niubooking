import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import '../runtime/native-location-task';

SplashScreen.preventAutoHideAsync();

export default function DriverLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
