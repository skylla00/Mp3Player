import { requireNativeModule } from "expo";

interface DeviceMusicModule {
  getMusicAssetIds(): Promise<string[]>;
}

let nativeModule: DeviceMusicModule | undefined;

/** Returns the Android media-store IDs marked as music. */
export function getMusicAssetIds(): Promise<string[]> {
  nativeModule ??= requireNativeModule<DeviceMusicModule>("DeviceMusic");
  return nativeModule.getMusicAssetIds();
}
