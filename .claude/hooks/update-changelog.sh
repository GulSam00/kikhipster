#!/usr/bin/env bash
# git commit 직후 실행되어 CLAUDE.md의 "변경 이력" 표에 한 줄을 덧붙인다.
#
# stdin으로 hook 입력 JSON을 받지만 실제 정보는 git에서 직접 읽는다.
# (커밋 메시지가 heredoc으로 들어오면 tool_input.command 파싱이 불안정하기 때문)
#
# 표가 무한정 길어지면 CLAUDE.md가 매 세션 컨텍스트를 잠식하므로 최근 15행만 유지한다.
# 전체 이력은 git log가 정본이다.

set -uo pipefail

MAX_ROWS=15

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

MD="CLAUDE.md"
[ -f "$MD" ] || exit 0

hash=$(git log -1 --format='%h' 2>/dev/null) || exit 0
[ -n "$hash" ] || exit 0

# 이미 기록된 커밋이면 건너뛴다 (--amend, 재시도, commit 실패 후 재실행 대응)
if grep -qF "\`$hash\`" "$MD"; then
  exit 0
fi

date=$(git log -1 --format='%ad' --date=short)
# 표 셀을 깨뜨리지 않도록 파이프 문자를 이스케이프
subject=$(git log -1 --format='%s' | sed 's/|/\\|/g')
# 변경된 최상위 디렉토리(또는 루트 파일명)를 "대상" 칸에 넣는다
scope=$(git show --name-only --format='' HEAD | awk -F/ 'NF{print $1}' | sort -u | paste -sd'·' -)
[ -n "$scope" ] || scope='-'

printf '| %s | %s | %s | 커밋 `%s` |\n' "$date" "$subject" "$scope" "$hash" >> "$MD"

# 오래된 행 정리 — 날짜로 시작하는 데이터 행만 센다
rows=$(grep -c '^| 20[0-9][0-9]-' "$MD" || true)
if [ "${rows:-0}" -gt "$MAX_ROWS" ]; then
  excess=$((rows - MAX_ROWS))
  awk -v n="$excess" '/^\| 20[0-9][0-9]-/ && c < n { c++; next } { print }' "$MD" > "$MD.tmp" \
    && mv "$MD.tmp" "$MD"
fi

# 대기 작업/현재 상태 섹션은 기계적으로 판단할 수 없으므로 모델에게 검토를 요청한다
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"방금 커밋이 CLAUDE.md의 변경 이력 표에 자동 기록되었다. 이번 커밋으로 CLAUDE.md '대기 중인 작업' 표의 항목이 완료됐거나 '현재 상태' 섹션(브랜치·직전 작업·경고)이 사실과 달라졌다면 그 부분도 함께 갱신하라. 달라진 것이 없으면 아무 조치도 하지 말고 사용자에게 언급하지도 말 것."},"suppressOutput":true}
JSON
