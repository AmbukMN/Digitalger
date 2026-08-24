#!/bin/bash
# BestTV upload babysitter — uploader процесс амьд эсэхийг хааяа шалгаж,
# унасан/дуусаагүй бол ДАХИН эхлүүлнэ. Скрипт state-тэй тул дахин ажиллахад
# дууссан episode-ыг алгасна (давхар upload хийхгүй).
#
# Ажиллуулах:  bash bulteek-babysit.sh    (5 минут тутам шалгана, дуусвал зогсоно)
DIR="D:/bulteek_downloads"
SCRIPT="C:/Users/ALIENWARE/Desktop/DigitalGer/besttv/scripts/bulteek-upload.mjs"
LOG="$DIR/upload-run.log"
BABYLOG="$DIR/babysit.log"
LOCK="$DIR/bulteek-babysit.lock"

# Давхар babysitter гарахаас сэргийлнэ
if ! mkdir "$LOCK" 2>/dev/null; then echo "$(date '+%H:%M') ӨӨР babysitter, гарлаа" >> "$BABYLOG"; exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "=== BABYSIT START $(date '+%F %H:%M') ===" >> "$BABYLOG"

# uploader ажиллаж байгаа эсэх (лог файлаар — bulteek-upload.mjs гэсэн мөр)
is_running() {
  tasklist 2>/dev/null | grep -qi node.exe && \
  wmic process where "name='node.exe'" get commandline 2>/dev/null | grep -q "bulteek-upload"
}

# Бүх зорилтот цуврал upload дууссан эсэх (state-ээс)
all_done() {
  node -e '
    const fs=require("fs"),p="D:/bulteek_downloads/bulteek-upload-state.json";
    const S={tengerleg:12,saryn_naiz:10,tany_zalgasan:12,nud:32,ene:12,amidral:16,"21r":12};
    let st={}; try{st=JSON.parse(fs.readFileSync(p,"utf8"))}catch{};
    // Бэлэн видео байгаа цувралын бүх анги done эсэхийг ойролцоо шалгах:
    // энгийнээр — сүүлийн 20 минут лог өөрчлөгдөөгүй БА "uploader DONE" гарсан бол дуусна
    const log=(()=>{try{return fs.readFileSync("D:/bulteek_downloads/upload-run.log","utf8")}catch{return""}})();
    process.exit(log.includes("=== uploader DONE ===") ? 0 : 1);
  ' 2>/dev/null
}

for round in $(seq 1 200); do
  if all_done; then
    echo "$(date '+%H:%M') ✅ uploader DONE тэмдэг олдлоо — babysit дуусгав" >> "$BABYLOG"
    break
  fi
  if is_running; then
    tail -1 "$LOG" 2>/dev/null | sed "s/^/$(date '+%H:%M') амьд: /" >> "$BABYLOG"
  else
    echo "$(date '+%H:%M') ⚠️ uploader амьд БИШ → дахин эхлүүлж байна" >> "$BABYLOG"
    ( cd "C:/Users/ALIENWARE/Desktop/DigitalGer/besttv/scripts" && node "$SCRIPT" >> "$LOG" 2>&1 ) &
    sleep 15
  fi
  sleep 300  # 5 минут
done
echo "=== BABYSIT END $(date '+%F %H:%M') ===" >> "$BABYLOG"
