package com.srd.mobile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

/** Guarda solo el código de la junta; el servidor HTTPS está definido en la app. */
class ConnectionModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val preferences = context.getSharedPreferences("srd_connection", 0)

  override fun getName(): String = "SrdConnection"

  override fun getConstants(): MutableMap<String, Any> = mutableMapOf(
    "apiOrigin" to BuildConfig.SRD_API_ORIGIN,
    "qaBuild" to BuildConfig.SRD_QA_BUILD,
  )

  @ReactMethod
  fun load(promise: Promise) {
    val result = WritableNativeMap()
    result.putString("code", preferences.getString("code", ""))
    promise.resolve(result)
  }

  @ReactMethod
  fun save(code: String, promise: Promise) {
    if (preferences.edit().clear().putString("code", code).commit()) {
      promise.resolve(null)
    } else {
      promise.reject("SAVE_FAILED", "No se pudo guardar el código de la junta.")
    }
  }

  @ReactMethod
  fun clear(promise: Promise) {
    if (preferences.edit().clear().commit()) {
      promise.resolve(null)
    } else {
      promise.reject("CLEAR_FAILED", "No se pudo borrar la dirección de la junta.")
    }
  }
}
