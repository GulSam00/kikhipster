export default {
  printWidth: 100, // 한 줄 최대 길이
  tabWidth: 2, // 탭 크기 (스페이스 2칸)
  singleQuote: true, // 작은따옴표 사용
  trailingComma: 'all', // 여러 줄일 때 항상 쉼표 사용
  // 기존 코드가 이 스타일이다(단일 인자 괄호 163곳). 'avoid' 로 두면 그 163곳이 바뀌는데
  // 타입 주석이 붙은 것(`(t): t is X =>`, 7곳)과 구조분해(65곳)는 문법상 괄호가 강제돼서
  // 한 파일 안에 두 스타일이 섞인다.
  arrowParens: 'always', // 화살표 함수 괄호 유지 (ex: (x) => x)
  bracketSpacing: true, // 중괄호 간격 유지 (ex: { foo: bar })
  jsxSingleQuote: false, // JSX에서 작은따옴표 사용 안 함
  endOfLine: 'auto',

  // @ianvs 포크는 @trivago 의 importOrderSeparation / importOrderSortSpecifiers 를
  // 받지 않는다(넣으면 "Ignored unknown option" 경고). 그룹 사이 빈 줄은 배열 안의
  // '' 로 나타내고, specifier 정렬은 기본 동작이라 옵션이 필요 없다.
  //
  // 먼저 매칭되는 규칙이 이기므로 좁은 경로를 위에 둔다 — @/lib/hooks 가
  // @/lib 보다 앞에 있어야 훅이 따로 묶인다.
  importOrder: [
    '<THIRD_PARTY_MODULES>',
    '',
    '^@/components/(.*)$',
    '',
    '^@/lib/hooks/(.*)$',
    '',
    '^@/lib/(.*)$',
    '',
    '^@/types/(.*)$',
    '',
    '^@/app/(.*)$',
    '',
    '^../(.*)$',
    '^./(.*)$',
  ],
  // className= 속성만이 아니라 cn(...) 인자 안의 문자열도 정렬한다. 이 프로젝트는
  // cn() 을 36개 파일에서 쓰므로 이게 없으면 절반만 정렬된 상태가 된다.
  tailwindFunctions: ['cn'],

  // tailwindcss 플러그인은 반드시 마지막이어야 한다(공식 문서 명시).
  plugins: ['@ianvs/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],
};
