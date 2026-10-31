#!/usr/bin/env bash
set -euo pipefail

result_file='apps/mobile-expo/test-results/expo-native-emulator.junit.xml'
mkdir -p apps/mobile-expo/test-results
adb install -t apps/mobile-expo/android/app/build/outputs/apk/release/app-release.apk
adb shell monkey -p com.srd.mobileexpo -c android.intent.category.LAUNCHER 1

for attempt in $(seq 1 60); do
  adb shell uiautomator dump /sdcard/srd-expo-window.xml >/dev/null 2>&1 || true
  if adb exec-out cat /sdcard/srd-expo-window.xml 2>/dev/null | grep -Fq 'Identifica tu junta'; then
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

cat > "$result_file" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="SRD Expo SDK 58 native startup" tests="1" failures="1" errors="0" skipped="0">
  <testcase classname="srd.expo.android" name="install and render join screen">
    <failure message="join screen not rendered within 60 seconds"/>
  </testcase>
</testsuite>
EOF
echo 'Expo native APK did not render the join screen within 60 seconds.' >&2
exit 1
