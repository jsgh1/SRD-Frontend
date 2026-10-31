#!/usr/bin/env bash
set -euo pipefail

result_file='apps/mobile-expo/test-results/expo-native-emulator.junit.xml'
diagnostics_dir='apps/mobile-expo/test-results'
window_file='/sdcard/srd-expo-window.xml'
mkdir -p "$diagnostics_dir"

capture_startup_diagnostics() {
  {
    printf 'BootCompleted: '
    adb shell getprop sys.boot_completed 2>&1 || true
    printf '\nAppProcess: '
    adb shell pidof com.srd.mobileexpo 2>&1 || true
    printf '\nResumedActivity:\n'
    adb shell dumpsys activity activities 2>/dev/null |
      grep -E 'mResumedActivity|topResumedActivity' | tail -n 4 || true
  } > "$diagnostics_dir/expo-native-state.txt"

  adb shell uiautomator dump "$window_file" \
    > "$diagnostics_dir/expo-native-ui-dump.txt" 2>&1 || true
  adb exec-out cat "$window_file" \
    > "$diagnostics_dir/expo-native-ui.xml" 2>/dev/null || true
  adb logcat -d -v brief -t 300 \
    -s AndroidRuntime:E ReactNativeJS:E ExpoModulesCore:E ReactNative:E \
    > "$diagnostics_dir/expo-native-logcat.txt" 2>&1 || true
  adb exec-out screencap -p \
    > "$diagnostics_dir/expo-native-screen.png" 2>/dev/null || true
}

adb install -t apps/mobile-expo/android/app/build/outputs/apk/release/app-release.apk
adb shell monkey -p com.srd.mobileexpo -c android.intent.category.LAUNCHER 1

for attempt in $(seq 1 60); do
  adb shell uiautomator dump "$window_file" >/dev/null 2>&1 || true
  if adb exec-out cat "$window_file" 2>/dev/null | grep -Fq 'Identifica tu junta'; then
    cat > "$result_file" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="SRD Expo SDK 58 native startup" tests="1" failures="0" errors="0" skipped="0">
  <testcase classname="srd.expo.android" name="install and render join screen"/>
</testsuite>
EOF
    echo 'PASS SDK 58 native APK installed and rendered the join screen.'
    exit 0
  fi
  sleep 1
done

capture_startup_diagnostics
cat > "$result_file" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="SRD Expo SDK 58 native startup" tests="1" failures="1" errors="0" skipped="0">
  <testcase classname="srd.expo.android" name="install and render join screen">
    <failure message="join screen not rendered within 60 seconds"/>
  </testcase>
</testsuite>
EOF
echo 'Expo native APK did not render the join screen within 60 seconds; non-secret startup diagnostics were captured.' >&2
exit 1
