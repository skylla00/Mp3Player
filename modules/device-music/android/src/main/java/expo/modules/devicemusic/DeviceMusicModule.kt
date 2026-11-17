package expo.modules.devicemusic

import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DeviceMusicModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeviceMusic")

    AsyncFunction("getMusicAssetIds") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("React context is unavailable.")
      val ids = mutableListOf<String>()
      val cursor = context.contentResolver.query(
        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
        arrayOf(MediaStore.Audio.Media._ID),
        "${MediaStore.Audio.Media.IS_MUSIC} = ?",
        arrayOf("1"),
        null
      ) ?: throw IllegalStateException("Could not query music files from MediaStore.")

      cursor.use {
        val idColumn = it.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
        while (it.moveToNext()) {
          ids.add(it.getLong(idColumn).toString())
        }
      }

      ids
    }
  }
}
