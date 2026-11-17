import { requireNativeModule } from "expo";

let nativeModule;

export function getMusicAssetIds() {
  nativeModule ??= requireNativeModule("DeviceMusic");
  return nativeModule.getMusicAssetIds();
}
