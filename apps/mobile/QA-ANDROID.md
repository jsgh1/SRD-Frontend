# Android QA build

The Android project has two product flavors:

- `production` keeps application id `com.srd.mobile`, uses the official HTTPS Gateway compiled into the APK, and rejects any other origin.
- `qa` installs separately as `com.srd.mobile.qa`, is labeled `SRD QA`, and accepts only localhost, private-network, `.localhost`, or `.test` Gateway origins. Its default is `http://127.0.0.1:8080`.

The QA flavor rejects the production host and public hosts in both Gradle configuration and the JavaScript origin resolver. Cleartext HTTP is enabled only in QA for local/private laboratory origins; the production flavor keeps it disabled. Do not put credentials or secrets in the origin.

From PowerShell, build an embedded QA debug APK with:

```powershell
Set-Location apps/mobile/android
$env:GRADLE_USER_HOME = 'G:\SRD-Work\gradle-cache'
$env:TEMP = 'G:\SRD-Work\temp'
$env:TMP = 'G:\SRD-Work\temp'
.\gradlew.bat :app:assembleQaDebug -PsrdEmbedDebugJs=true -PsrdQaApiOrigin=http://127.0.0.1:8080 --no-daemon --max-workers=1
```

The artifact is written under `android/app/build/outputs/apk/qa/debug/`. To connect an Android emulator to a Gateway published on host port 8080, run `adb reverse tcp:8080 tcp:8080` while that emulator is connected, then install the QA APK. This command does not make a production request; the QA flavor cannot accept the production hostname.

Use an HTTPS `.test` or private lab Gateway for remote devices. HTTP is accepted only for a loopback or private-network QA origin. The production flavor does not read this Gradle property and cannot be redirected by it.

Jest covers accepted/rejected origins. Gradle compilation and device behavior must still be recorded separately; these unit tests alone do not constitute Android device acceptance.
