# 백업: 대결 튕겨내기 — CSS keyframes 판 (2026-08-30)

`motion` 스프링으로 갈아엎기 **직전** 상태다. 되돌리려면 이 두 파일을 그대로 덮어쓰면 된다.

```
cp backup/2026-08-30-battle-css-keyframes/globals.css  frontend/app/globals.css
cp backup/2026-08-30-battle-css-keyframes/page.tsx     "frontend/app/play/[playId]/page.tsx"
```

## 이 판이 하던 것

- `app/globals.css` 의 `@keyframes battle-winner` / `battle-loser`
  (`--animate-battle-winner`, `--animate-battle-loser`)
- 방향은 `--battle-dir`(1 / -1), 중앙까지의 거리는
  `calc(50% + var(--battle-gap) / 2)` — 그래서 격자가 간격을 유틸리티가 아니라
  `gap-(--battle-gap)` 변수로 들고 있었다
- 진 카드 `z-20`, 이긴 카드 `relative z-10`
- 이긴 카드는 34% 까지 자기 자리 근처에서 버티다 중앙으로, 진 카드는 72% 까지 불투명

## 왜 갈아탔나

CSS keyframes 는 **정해진 궤적을 재생**할 뿐이라 부딪히는 순간의 관성·반동이 손으로 찍은
값이다. `motion`(이미 설치돼 있다)의 스프링은 초기 속도를 주면 목표를 지나쳤다가 되돌아와
**밀고 들어갔다 자리 잡는 동작이 물리적으로 나온다.** 스프링은 목표값으로 수렴하므로
"이긴 카드가 정확히 가운데에 선다"는 요구도 그대로 지켜진다.

새 판에서는 거리를 CSS `calc` 로 계산하지 않고 **두 카드의 실제 화면 좌표를 재서** 쓴다.

## 되돌릴 때 같이 봐야 하는 것

`package.json` 의 `motion` 은 `SplitFlapText`(진행 계기판)도 쓰므로 **지우면 안 된다.**
