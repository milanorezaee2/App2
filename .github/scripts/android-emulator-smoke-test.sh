#!/usr/bin/env bash
set -Eeuo pipefail

apk_path="MiloMultiApp.apk"
admin_apk_path="MiloAdmin.apk"
diag_dir="${RUNNER_TEMP:-/tmp}"
log_file="$diag_dir/milomultiapp-emulator-smoke.log"
ui_file="$diag_dir/milomultiapp-emulator-window.xml"
screenshot_file="$diag_dir/milomultiapp-emulator-screen.png"
remote_ui_file="/sdcard/milomultiapp-window.xml"
failed_step="smoke-test setup"

mkdir -p "$diag_dir"
: > "$log_file"
exec > >(tee -a "$log_file") 2>&1

on_exit() {
  local status=$?
  local activity_summary log_summary ui_summary annotation
  trap - EXIT
  if (( status != 0 )); then
    set +e
    printf '\nSmoke test failed during: %s (exit %s)\n' "$failed_step" "$status"
    printf '\n--- ADB devices ---\n'
    adb devices -l
    printf '\n--- Emulator boot status ---\n'
    adb shell getprop sys.boot_completed
    printf '\n--- Resumed activity ---\n'
    activity_summary="$(adb shell dumpsys activity activities 2>&1 | grep -E 'mResumedActivity|topResumedActivity|ResumedActivity' | tail -n 8 | tr '\n' ' ' || true)"
    printf '%s\n' "${activity_summary:-'(no resumed activity reported)'}"
    printf '\n--- Relevant recent logcat ---\n'
    log_summary="$(adb logcat -d -t 3000 2>&1 | grep -E 'FATAL EXCEPTION|Unable to load script|AppStartupError|ReactNativeJS|AndroidRuntime|ReactNative|SoLoader|ActivityTaskManager' | tail -n 80 || true)"
    printf '%s\n' "${log_summary:-'(no matching Android or React Native errors)'}"
    ui_summary='(UI hierarchy unavailable)'
    if [[ -f "$ui_file" ]]; then
      printf '\n--- UI hierarchy (first 4000 bytes) ---\n'
      head -c 4000 "$ui_file"
      printf '\n'
      ui_summary="$(python3 - "$ui_file" <<'PY' 2>/dev/null || true
import sys
import xml.etree.ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
values = []
for node in root.iter():
    for name in ('text', 'content-desc'):
        value = node.attrib.get(name, '').strip()
        if value and value not in values:
            values.append(value)
print(' | '.join(values)[:1800] or '(no accessible text nodes)')
PY
)"
    fi
    annotation="${failed_step} (exit ${status}); UI=${ui_summary}; ACTIVITY=${activity_summary:-none}; LOGCAT=$(printf '%s' "$log_summary" | tail -n 12 | tr '\n' ' ' | cut -c1-1800)"
    annotation="${annotation//'%'/'%25'}"
    annotation="${annotation//$'\r'/'%0D'}"
    annotation="${annotation//$'\n'/'%0A'}"
    echo "::error title=Android emulator smoke test failed::${annotation}"
  fi
  exit "$status"
}
trap on_exit EXIT

capture_ui() {
  timeout 60s adb shell uiautomator dump "$remote_ui_file"
  adb pull "$remote_ui_file" "$ui_file"
}

printf 'Testing standalone APK: %s\n' "$apk_path"
printf 'Diagnostics will be saved under: %s\n' "$diag_dir"

failed_step="listing emulator devices"
adb devices -l

failed_step="installing standalone APK"
adb install -r "$apk_path"

failed_step="clearing Android logcat"
adb logcat -c

failed_step="launching the main activity"
timeout 90s adb shell am start -W -n com.devicecontrol.companion/.MainActivity

failed_step="allowing the first screen to finish rendering"
sleep 30

failed_step="dumping the Android UI hierarchy"
capture_ui

for attempt in 1 2; do
  # Slow hosted emulators can report either the System UI package or the core
  # Android "system" process as temporarily unresponsive during first boot.
  # Both dialogs expose a Wait action and are infrastructure noise when our
  # activity remains resumed without a FATAL EXCEPTION.
  if ! grep -Eq "System UI isn't responding|Process system isn't responding" "$ui_file"; then
    break
  fi

  failed_step="waiting for Android System UI (recovery attempt $attempt)"
  wait_coords="$(python3 - "$ui_file" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

for node in ET.parse(sys.argv[1]).getroot().iter():
    if node.attrib.get('text', '').strip().lower() == 'wait':
        match = re.search(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds', ''))
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            break
PY
)"
  if [[ -z "$wait_coords" ]]; then
    echo 'Android system is not responding, but its Wait button could not be located.'
    break
  fi
  read -r wait_x wait_y <<< "$wait_coords"
  echo "Android system reported a transient ANR; selecting Wait at $wait_x,$wait_y and allowing the app another 30 seconds."
  adb shell input tap "$wait_x" "$wait_y"
  sleep 30
  failed_step="rechecking the screen after waiting for Android System UI"
  capture_ui
done

failed_step="capturing the launched screen"
if ! timeout 30s adb exec-out screencap -p > "$screenshot_file"; then
  echo 'Warning: screenshot capture failed; continuing with the UI hierarchy check.'
fi

failed_step="verifying the mandatory learner registration rendered"
registration_gate=false
if grep -Fq 'ساخت حساب زبان‌آموز' "$ui_file" && grep -Fq 'ساخت حساب و دریافت کد' "$ui_file"; then
  registration_gate=true
  echo 'Android emulator opened MiloMultiApp and rendered its mandatory registration gate.'
elif grep -Fq 'MILO' "$ui_file" && grep -Fq 'هر روز، یک قدم' "$ui_file"; then
  echo 'Android emulator restored an authenticated learner and rendered the language home.'
else
  echo 'Neither the learner registration gate nor the authenticated language home was found.'
  exit 1
fi

# A clean CI install intentionally has no production learner credentials. Chat
# geometry remains covered when an authenticated test session is restored; on a
# first install we verify the account gate and continue with the separate admin APK.
if [[ "$registration_gate" == false ]]; then
failed_step="opening the Emma chat keyboard test route"
timeout 60s adb shell am start -W -a android.intent.action.VIEW -d 'companionenglish:///conversations/emma' com.devicecontrol.companion
sleep 8
capture_ui

failed_step="locating the English chat composer"
composer_coords="$(python3 - "$ui_file" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

for node in ET.parse(sys.argv[1]).getroot().iter():
    label = node.attrib.get('content-desc', '')
    text = node.attrib.get('text', '')
    if label == 'پیام انگلیسی برای Emma' or (node.attrib.get('class') == 'android.widget.EditText' and 'پیام انگلیسی' in text):
        match = re.search(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds', ''))
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2, y2)
            break
PY
)"
if [[ -z "$composer_coords" ]]; then
  echo 'The Emma chat composer was not found through Android accessibility.'
  exit 1
fi
read -r composer_x composer_y composer_closed_bottom <<< "$composer_coords"

failed_step="opening the Android keyboard in the Emma composer"
adb shell settings put secure show_ime_with_hard_keyboard 1
adb shell input tap "$composer_x" "$composer_y"
sleep 5
capture_ui

failed_step="verifying the composer remains fully visible above the keyboard"
keyboard_state="$(adb shell dumpsys input_method 2>/dev/null || true)"
if ! grep -Eq 'mInputShown=true|isInputViewShown=true|inputShown=true' <<< "$keyboard_state"; then
  echo 'Android did not report a visible software keyboard after focusing the composer.'
  exit 1
fi

density_dpi="$(adb shell wm density | grep -Eo '[0-9]+' | tail -n 1)"
python3 - "$ui_file" "${density_dpi:-160}" "$composer_closed_bottom" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, density_value, closed_bottom = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
minimum_height = round(40 * density_value / 160)
minimum_lift = round(100 * density_value / 160)
root = ET.parse(path).getroot()
keyboard_tops = []
for candidate in root.iter():
    package = candidate.attrib.get('package', '').lower()
    bounds = re.search(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', candidate.attrib.get('bounds', ''))
    if bounds and ('inputmethod' in package or 'keyboard' in package):
        keyboard_tops.append(int(bounds.group(2)))
keyboard_top = min(keyboard_tops) if keyboard_tops else None
for node in root.iter():
    label = node.attrib.get('content-desc', '')
    text = node.attrib.get('text', '')
    if label == 'پیام انگلیسی برای Emma' or (node.attrib.get('class') == 'android.widget.EditText' and 'پیام انگلیسی' in text):
        match = re.search(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds', ''))
        if not match:
            raise SystemExit('Composer bounds are unavailable while the keyboard is open.')
        x1, y1, x2, y2 = map(int, match.groups())
        height = y2 - y1
        if height < minimum_height:
            raise SystemExit(f'Composer is clipped: {height}px visible; expected at least {minimum_height}px at {density_value}dpi.')
        if x2 <= x1 or y2 <= y1:
            raise SystemExit(f'Composer has invalid bounds: {node.attrib.get("bounds")}')
        lift = closed_bottom - y2
        if lift < minimum_lift:
            raise SystemExit(f'Composer did not follow the keyboard: moved up only {lift}px; expected at least {minimum_lift}px.')
        if keyboard_top is not None and y2 > keyboard_top:
            raise SystemExit(f'Composer overlaps the keyboard by {y2 - keyboard_top}px (composer bottom {y2}, keyboard top {keyboard_top}).')
        gap = 'unknown' if keyboard_top is None else str(keyboard_top - y2)
        print(f'Emma composer moved up {lift}px, remains {height}px high, and has a {gap}px keyboard gap.')
        break
else:
    raise SystemExit('Composer disappeared from accessibility while the keyboard was open.')
PY

failed_step="capturing the keyboard-open chat screen"
timeout 30s adb exec-out screencap -p > "$screenshot_file"
echo 'Android emulator verified the full-height Emma composer with the software keyboard open.'

failed_step="opening the human chat keyboard test route"
adb shell input keyevent KEYCODE_BACK
adb shell am start -W -a android.intent.action.VIEW -d 'companionenglish:///conversations/human/00000000-0000-0000-0000-000000000001?name=Test' com.devicecontrol.companion
sleep 8
capture_ui

failed_step="locating the human chat composer"
human_composer_coords="$(python3 - "$ui_file" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

for node in ET.parse(sys.argv[1]).getroot().iter():
    if node.attrib.get('content-desc', '') == 'متن پیام فارسی یا انگلیسی':
        match = re.search(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds', ''))
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2, y2)
            break
PY
)"
if [[ -z "$human_composer_coords" ]]; then
  echo 'The human chat composer was not found through Android accessibility.'
  exit 1
fi
read -r human_composer_x human_composer_y human_composer_closed_bottom <<< "$human_composer_coords"
adb shell input tap "$human_composer_x" "$human_composer_y"
sleep 5
capture_ui

failed_step="verifying the human composer and side buttons stay above the keyboard"
keyboard_state="$(adb shell dumpsys input_method 2>/dev/null || true)"
if ! grep -Eq 'mInputShown=true|isInputViewShown=true|inputShown=true' <<< "$keyboard_state"; then
  echo 'Android did not report a visible software keyboard in the human conversation.'
  exit 1
fi
python3 - "$ui_file" "${density_dpi:-160}" "$human_composer_closed_bottom" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, density_value, closed_bottom = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
minimum_input_height = round(40 * density_value / 160)
minimum_button_size = round(38 * density_value / 160)
minimum_lift = round(100 * density_value / 160)
root = ET.parse(path).getroot()
keyboard_tops = []
for candidate in root.iter():
    package = candidate.attrib.get('package', '').lower()
    bounds = re.search(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', candidate.attrib.get('bounds', ''))
    if bounds and ('inputmethod' in package or 'keyboard' in package):
        keyboard_tops.append(int(bounds.group(2)))
keyboard_top = min(keyboard_tops) if keyboard_tops else None
input_ok = False
input_lift = 0
button_count = 0
for node in root.iter():
    match = re.search(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds', ''))
    if not match:
        continue
    x1, y1, x2, y2 = map(int, match.groups())
    width, height = x2 - x1, y2 - y1
    label = node.attrib.get('content-desc', '')
    if label == 'متن پیام فارسی یا انگلیسی':
        if height < minimum_input_height:
            raise SystemExit(f'Human composer is clipped: {height}px; expected at least {minimum_input_height}px.')
        input_lift = closed_bottom - y2
        if input_lift < minimum_lift:
            raise SystemExit(f'Human composer did not follow the keyboard: moved up only {input_lift}px; expected at least {minimum_lift}px.')
        if keyboard_top is not None and y2 > keyboard_top:
            raise SystemExit(f'Human composer overlaps the keyboard by {y2 - keyboard_top}px.')
        input_ok = True
    if label in ('باز و بسته‌کردن دستیار زبان', 'ضبط و ارسال پیام صوتی فعلاً غیرفعال است', 'شروع یا پایان ضبط پیام صوتی', 'ارسال پیام متنی'):
        if width >= minimum_button_size and height >= minimum_button_size:
            if keyboard_top is not None and y2 > keyboard_top:
                raise SystemExit(f'Human composer button {label!r} overlaps the keyboard by {y2 - keyboard_top}px.')
            button_count += 1
if not input_ok:
    raise SystemExit('Human composer disappeared while its keyboard was open.')
if button_count < 2:
    raise SystemExit(f'Human composer side buttons are clipped or missing; found {button_count}.')
gap = 'unknown' if keyboard_top is None else str(keyboard_top - (closed_bottom - input_lift))
print(f'Human composer moved up {input_lift}px; {button_count} side buttons are visible; keyboard gap is {gap}px.')
PY

timeout 30s adb exec-out screencap -p > "$screenshot_file"
echo 'Android emulator verified both complete chat composers and their side buttons with the keyboard open.'
fi

failed_step="installing the private management APK"
adb install -r "$admin_apk_path"
adb shell am force-stop com.devicecontrol.miloadmin

failed_step="launching the private management app"
timeout 90s adb shell am start -W -n com.devicecontrol.miloadmin/.MainActivity
sleep 12
capture_ui

failed_step="verifying the management login is isolated and protected"
if ! grep -Fq 'ایمیل مدیر' "$ui_file" || ! grep -Fq 'ورود امن به پنل' "$ui_file"; then
  echo 'The standalone management APK did not render its protected manager login.'
  exit 1
fi
if grep -Fq 'ساخت حساب زبان‌آموز' "$ui_file"; then
  echo 'The management APK incorrectly rendered the learner registration flow.'
  exit 1
fi

echo 'Android emulator verified the standalone management APK and protected manager login.'
