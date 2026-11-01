#!/usr/bin/env bash
set -euo pipefail

result_file='apps/mobile-expo/test-results/expo-native-emulator.junit.xml'
diagnostics_dir='apps/mobile-expo/test-results'
window_file='/sdcard/srd-expo-window.xml'
launch_file="$diagnostics_dir/expo-native-launch.txt"
provenance_file="$diagnostics_dir/expo-native-provenance.txt"
mkdir -p "$diagnostics_dir"

apk_file='apps/mobile-expo/android/app/build/outputs/apk/release/app-release.apk'
{
  printf 'SourceCommit: '
  git rev-parse HEAD
  printf 'APK_SHA256: '
  sha256sum "$apk_file" | cut -d ' ' -f 1
  printf 'ApplicationId: com.srd.mobileexpo\n'
  printf 'Activity: com.srd.mobileexpo/.MainActivity\n'
} > "$provenance_file"

write_failure_result() {
  cat > "$result_file" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="SRD Expo SDK 58 native startup" tests="1" failures="1" errors="0" skipped="0">
  <testcase classname="srd.expo.android" name="install, launch and render accessible join controls">
    <failure message="native startup acceptance failed; inspect stage diagnostics"/>
  </testcase>
</testsuite>
EOF
}

capture_startup_diagnostics() {
  local ui_mode="${1:-capture}"
  {
    printf 'BootCompleted: '
    adb shell getprop sys.boot_completed 2>&1 || true
    printf '\nAppProcess: '
    adb shell pidof com.srd.mobileexpo 2>&1 || true
    printf '\nResumedActivity:\n'
    adb shell dumpsys activity activities 2>/dev/null |
      grep -E 'mResumedActivity|topResumedActivity' | tail -n 4 || true
  } > "$diagnostics_dir/expo-native-state.txt"

  if [[ "$ui_mode" != 'preserve-ui' ]]; then
    adb shell uiautomator dump --compressed "$window_file" \
      > "$diagnostics_dir/expo-native-ui-dump.txt" 2>&1 || true
    adb exec-out cat "$window_file" \
      > "$diagnostics_dir/expo-native-ui.xml" 2>/dev/null || true
  fi
  adb logcat -d -v brief -t 500 2>/dev/null |
    grep -E 'AndroidRuntime|ReactNativeJS|ReactNative|ExpoModulesCore|Hermes' |
    tail -n 200 > "$diagnostics_dir/expo-native-logcat.txt" || true
  sed -E \
    -e 's/(Bearer )[A-Za-z0-9._~-]+/\1[REDACTED]/g' \
    -e 's/([?&](token|code|secret|password)=)[^&[:space:]]+/\1[REDACTED]/gi' \
    "$diagnostics_dir/expo-native-logcat.txt" > "$diagnostics_dir/expo-native-logcat.txt.tmp" || true
  if [[ -f "$diagnostics_dir/expo-native-logcat.txt.tmp" ]]; then
    mv "$diagnostics_dir/expo-native-logcat.txt.tmp" "$diagnostics_dir/expo-native-logcat.txt"
  fi
  adb exec-out screencap -p \
    > "$diagnostics_dir/expo-native-screen.png" 2>/dev/null || true
}

failure_stage='install'
if ! adb install -t "$apk_file"; then
  capture_startup_diagnostics
  write_failure_result
  echo "Expo native startup acceptance failed at stage: $failure_stage; non-secret diagnostics were captured." >&2
  exit 1
fi

failure_stage='launch'
if ! adb shell am start -W -n com.srd.mobileexpo/.MainActivity > "$launch_file" 2>&1 ||
  ! grep -Fq 'Status: ok' "$launch_file"; then
  capture_startup_diagnostics
  write_failure_result
  echo 'Expo native APK could not start its main activity; non-secret diagnostics were captured.' >&2
  exit 1
fi

failure_stage='foreground-activity'
for attempt in $(seq 1 30); do
  if adb shell dumpsys activity activities 2>/dev/null |
    grep -E 'mResumedActivity|topResumedActivity' |
    grep -Fq 'com.srd.mobileexpo/.MainActivity'; then
    break
  fi
  sleep 1
done

if ! adb shell dumpsys activity activities 2>/dev/null |
  grep -E 'mResumedActivity|topResumedActivity' |
  grep -Fq 'com.srd.mobileexpo/.MainActivity'; then
  capture_startup_diagnostics
  write_failure_result
  echo 'Expo native APK activity did not become foreground within 30 seconds; non-secret diagnostics were captured.' >&2
  exit 1
fi

failure_stage='accessibility-controls'
adb shell uiautomator dump --compressed "$window_file" \
  > "$diagnostics_dir/expo-native-ui-dump.txt" 2>&1 || true
adb exec-out cat "$window_file" > "$diagnostics_dir/expo-native-ui.xml" 2>/dev/null || true
input_node="$(grep -oE '<node[^>]*/>' "$diagnostics_dir/expo-native-ui.xml" |
  grep -F 'class="android.widget.EditText"' |
  grep -F 'content-desc="Código de junta"' | head -n 1 || true)"
button_node="$(grep -oE '<node[^>]*>' "$diagnostics_dir/expo-native-ui.xml" |
  grep -F 'class="android.widget.Button"' |
  grep -F 'content-desc="Continuar"' |
  grep -F 'clickable="true"' | head -n 1 || true)"
if grep -Fq 'Identifica tu junta' "$diagnostics_dir/expo-native-ui.xml" &&
  [[ -n "$input_node" ]] && [[ -n "$button_node" ]] &&
  [[ -n "$(adb shell pidof com.srd.mobileexpo 2>/dev/null | tr -d '\r')" ]] &&
  ! adb logcat -d -v brief -t 500 2>/dev/null |
    grep -E 'FATAL EXCEPTION|Process: com\.srd\.mobileexpo|Unable to load script|No bundle URL found|Hermes.*(error|exception)'; then
  capture_startup_diagnostics preserve-ui
  cat > "$result_file" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="SRD Expo SDK 58 native startup" tests="1" failures="0" errors="0" skipped="0">
  <testcase classname="srd.expo.android" name="install, launch and render accessible join controls"/>
</testsuite>
EOF
  echo 'PASS SDK 58 native APK installed, launched directly and rendered accessible join controls.'
  exit 0
fi

capture_startup_diagnostics
write_failure_result
echo "Expo native startup acceptance failed at stage: $failure_stage; non-secret diagnostics were captured." >&2
exit 1
