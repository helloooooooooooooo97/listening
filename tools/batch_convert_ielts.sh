#!/bin/bash
# Batch convert all remaining IELTS M4A files to JSON using WhisperX
# Usage: ./tools/batch_convert_ielts.sh

set +e

LESSONS_DIR="/Users/apple1/Desktop/english/backend/app/data/lessons"
WHISPERX_PYTHON="/Users/apple1/Desktop/english/.venv-whisperx/bin/python3"
ALIGN_SCRIPT="/Users/apple1/Desktop/english/tools/align_with_whisperx.py"
LOG_FILE="/Users/apple1/Desktop/english/tools/conversion_log.txt"

# Model selection: base.en (cached locally, fast)
MODEL="base.en"
DEVICE="cpu"
LEVEL="B1-C1"
SOURCE_URL="https://www.bilibili.com/video/BV1o5gnzfEHQ/"
TEXT_SOURCE_URL="https://www.cambridgeenglish.org/exams-and-tests/ielts/"

# All remaining TODO files
TODO_FILES=(
  "ielts-c09-t2"
  "ielts-c09-t3"
  "ielts-c10-t1"
  "ielts-c10-t2"
  "ielts-c11-t1"
  "ielts-c11-t3"
  "ielts-c11-t4"
  "ielts-c12-t1"
  "ielts-c12-t2"
  "ielts-c12-t3"
  "ielts-c12-t4"
  "ielts-c13-t3"
  "ielts-c14-t1"
  "ielts-c14-t2"
  "ielts-c14-t3"
  "ielts-c14-t4"
  "ielts-c15-t2"
  "ielts-c15-t3"
  "ielts-c16-t1"
  "ielts-c16-t3"
  "ielts-c16-t4"
  "ielts-c17-t2"
  "ielts-c17-t4"
  "ielts-c18-t2"
  "ielts-c19-t2"
  "ielts-c19-t3"
  "ielts-c19-t4"
)

total=${#TODO_FILES[@]}
current=0

echo "========================================" | tee -a "$LOG_FILE"
echo "Batch IELTS Conversion Started: $(date)" | tee -a "$LOG_FILE"
echo "Model: $MODEL | Device: $DEVICE" | tee -a "$LOG_FILE"
echo "Total files to convert: $total" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

for file_id in "${TODO_FILES[@]}"; do
  current=$((current + 1))

  # Parse book number and test number from ID: ielts-cXX-tY
  # Use $((10#...)) to handle leading zeros without octal interpretation
  book_raw=$(echo "$file_id" | sed 's/ielts-c\([0-9]*\)-t[0-9]*/\1/')
  book=$((10#$book_raw))
  test_num=$(echo "$file_id" | sed 's/ielts-c[0-9]*-t\([0-9]*\)/\1/')

  # Format book number with leading zero
  book_fmt=$(printf "%02d" "$book")

  title="Cambridge IELTS ${book_fmt} Listening Test ${test_num}"
  subtitle="Cambridge IELTS ${book_fmt} Academic"

  audio_path="${LESSONS_DIR}/${file_id}.m4a"
  output_path="${LESSONS_DIR}/${file_id}.json"

  # Skip if JSON already exists
  if [ -f "$output_path" ]; then
    echo "[$current/$total] SKIP (already exists): $file_id" | tee -a "$LOG_FILE"
    continue
  fi

  # Skip if audio doesn't exist
  if [ ! -f "$audio_path" ]; then
    echo "[$current/$total] ERROR (no audio): $file_id" | tee -a "$LOG_FILE"
    continue
  fi

  echo "[$current/$total] Converting: $file_id ($title) ..." | tee -a "$LOG_FILE"
  echo "  Start: $(date)" | tee -a "$LOG_FILE"

  start_time=$(date +%s)

  if $WHISPERX_PYTHON "$ALIGN_SCRIPT" \
    --audio "$audio_path" \
    --output "$output_path" \
    --id "$file_id" \
    --title "$title" \
    --subtitle "$subtitle" \
    --level "$LEVEL" \
    --source-url "$SOURCE_URL" \
    --text-source-url "$TEXT_SOURCE_URL" \
    --model "$MODEL" \
    --language en \
    --device "$DEVICE" ; then

    end_time=$(date +%s)
    elapsed=$((end_time - start_time))
    minutes=$((elapsed / 60))
    seconds=$((elapsed % 60))
    echo "  ✓ Done in ${minutes}m ${seconds}s: $file_id" | tee -a "$LOG_FILE"
  else
    echo "  ✗ FAILED: $file_id" | tee -a "$LOG_FILE"
  fi

  echo "" | tee -a "$LOG_FILE"
done

echo "========================================" | tee -a "$LOG_FILE"
echo "Batch Conversion Completed: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
