#!/usr/bin/env bash
# git commit 직후 실행되어 docs/WORKLOG.md의 "커밋 이력" 표에 한 줄을 덧붙인다.
#
# stdin으로 hook 입력 JSON을 받지만 실제 정보는 git에서 직접 읽는다.
# (커밋 메시지가 heredoc으로 들어오면 tool_input.command 파싱이 불안정하기 때문)
#
# 기록 대상이 CLAUDE.md에서 docs/WORKLOG.md로 바뀌었다(2026-08-20). WORKLOG는 매 세션
# 컨텍스트에 자동 로드되지 않으므로 행 수를 제한하지 않고 전체 이력을 보존한다.

set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

MD="docs/WORKLOG.md"
[ -f "$MD" ] || exit 0

hash=$(git log -1 --format='%h' 2>/dev/null) || exit 0
[ -n "$hash" ] || exit 0

# 이미 기록된 커밋이면 건너뛴다 (--amend, 재시도, commit 실패 후 재실행 대응)
if grep -qF "\`$hash\`" "$MD"; then
  exit 0
fi

# 이 훅이 남긴 행을 그대로 커밋한 것뿐이라면 기록하지 않는다.
# 기록하면 그 커밋이 또 새 행을 낳아 커밋되지 않은 한 줄이 영원히 떠돈다.
changed=$(git show --name-only --format='' HEAD | awk 'NF')
if [ "$changed" = "$MD" ]; then
  exit 0
fi

date=$(git log -1 --format='%ad' --date=short)
# 표 셀을 깨뜨리지 않도록 파이프 문자를 이스케이프
subject=$(git log -1 --format='%s' | sed 's/|/\|/g')
# 변경된 최상위 디렉토리(또는 루트 파일명)를 "대상" 칸에 넣는다.
# paste -d 는 1바이트 구분자만 받으므로 멀티바이트 문자(·)를 쓰면 깨진다. ASCII 쉼표로 합친다.
scope=$(git show --name-only --format='' HEAD | awk -F/ 'NF{print $1}' | sort -u | paste -sd',' - | sed 's/,/, /g')
[ -n "$scope" ] || scope='-'

printf '| %s | %s | %s | 커밋 `%s` |\n' "$date" "$subject" "$scope" "$hash" >> "$MD"

# 과제 보드/세션 기록은 기계적으로 판단할 수 없으므로 모델에게 검토를 요청한다
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"방금 커밋이 docs/WORKLOG.md의 커밋 이력 표에 자동 기록되었다. 이번 커밋으로 docs/TASKS.md의 과제가 완료됐거나 차단 항목·현재 구현 범위가 사실과 달라졌다면 그 부분을 갱신하라. 커밋 메시지만으로 복원되지 않는 판단이나 검증 결과가 있었다면 docs/WORKLOG.md의 '세션 기록'에도 남겨라. 달라진 것이 없으면 아무 조치도 하지 말고 사용자에게 언급하지도 말 것."},"suppressOutput":true}
JSON
