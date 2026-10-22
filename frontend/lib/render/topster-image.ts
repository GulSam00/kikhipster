'use client';

import type { PoolItem } from '@/lib/domain/pool-item';

import type { TopsterOptions } from '@/types/topster';

/**
 * 탑스터를 PNG로 그려 내려받는다.
 *
 * DOM을 캡처하지 않고 캔버스에 직접 그린다 — DOM 캡처(html-to-image 등)는 웹폰트·CSS
 * 변수·레이아웃까지 재현해야 해서 깨질 구석이 훨씬 많고, 여기서 그릴 것은 사각형과
 * 이미지, 텍스트뿐이라 직접 그리는 편이 예측 가능하다.
 *
 * 커버는 mzstatic이 `access-control-allow-origin: *` 를 주므로 `crossOrigin='anonymous'`
 * 로 불러오면 캔버스가 오염되지 않아 toBlob 이 된다(2026-08-23 브라우저에서 확인).
 * 저장 전에도 동작한다 — 서버에 아무것도 안 물어보고 화면 상태만으로 그리기 때문이다.
 */

/**
 * 출력 셀 한 변(px). 화면은 "차지하는 영역이 고정"이라 칸이 늘면 셀이 작아지지만,
 * 내려받는 이미지는 레이아웃이 아니라 결과물이라 **셀 해상도를 고정**하고 격자에 딱 맞게
 * 자른다. 그래야 1x2 이미지에 빈 여백이 생기지 않고 커버 화질도 칸 수와 무관하게 같다.
 */
const CELL = 300;
const PADDING = 40;
const TITLE_HEIGHT = 80;
/** 제목과 본문을 가르는 구분선 — 배경색이 자유라 여백만으로는 경계가 안 보인다. */
const TITLE_RULE_GAP = 16;
/** 목록 칸 폭. 격자에 자리를 더 주려고 좁게 잡았다. */
const LIST_WIDTH = 480;

/** maxWidth 에 맞춰 줄바꿈한다. 잘라내지 않고 전부 보여주는 게 목적이다. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);

  // 한 단어가 통째로 폭을 넘으면(긴 영문 제목 등) 글자 단위로 더 쪼갠다.
  return lines.flatMap((l) => {
    if (ctx.measureText(l).width <= maxWidth) return [l];
    const out: string[] = [];
    let buf = '';
    for (const ch of l) {
      if (ctx.measureText(buf + ch).width > maxWidth && buf) {
        out.push(buf);
        buf = ch;
      } else {
        buf += ch;
      }
    }
    if (buf) out.push(buf);
    return out;
  });
}

/** maxWidth 를 넘으면 말줄임한다. fillText 의 maxWidth 는 글자를 눌러 찌그러뜨려서 못 쓴다. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    // 한 장 실패가 전체 다운로드를 막지 않게 한다 — 그 칸만 비워 그린다.
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

interface DrawArgs {
  options: TopsterOptions;
  title: string;
  items: { album_spotify_id: string; position: number }[];
  albums: Map<string, PoolItem | null>;
}

export async function renderTopsterBlob({
  options,
  title,
  items,
  albums,
}: DrawArgs): Promise<Blob | null> {
  const {
    width,
    height,
    background_color,
    text_color,
    cell_gap,
    show_title,
    show_album_info,
    show_numbering,
  } = options;

  // 화면에서는 대략 560px 폭에 cell_gap 이 적용된다. 출력 해상도에 맞춰 같은 비율로 키운다.
  const gap = Math.round(cell_gap * (CELL / 112));
  const gridW = width * CELL + (width - 1) * gap;
  const gridH = height * CELL + (height - 1) * gap;

  // 빈 행도 자리를 지켜야 격자와 목록의 줄이 어긋나지 않는다.
  const rows = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) =>
      items.find((it) => it.position === r * width + c),
    ).filter((it): it is NonNullable<typeof it> => Boolean(it)),
  );

  const hasList = show_album_info && rows.some((r) => r.length > 0);
  const titleH = show_title && title.trim() ? TITLE_HEIGHT : 0;

  const canvasW = PADDING * 2 + gridW + (hasList ? LIST_WIDTH : 0);
  const canvasH = PADDING * 2 + titleH + gridH;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = background_color;
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (titleH) {
    ctx.fillStyle = text_color;
    ctx.font = 'bold 40px Geist, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      ellipsize(ctx, title, canvasW - PADDING * 2),
      canvasW / 2,
      PADDING + (TITLE_HEIGHT - TITLE_RULE_GAP) / 2,
    );

    // 제목 구분선
    ctx.strokeStyle = text_color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING, PADDING + TITLE_HEIGHT - TITLE_RULE_GAP / 2);
    ctx.lineTo(canvasW - PADDING, PADDING + TITLE_HEIGHT - TITLE_RULE_GAP / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const gridTop = PADDING + titleH;

  // 커버를 한 번에 받아둔다 — 칸마다 순차로 기다리면 25칸에서 눈에 띄게 느려진다.
  const covers = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    [...new Set(items.map((i) => i.album_spotify_id))].map(async (id) => {
      const url = albums.get(id)?.coverUrl;
      covers.set(id, url ? await loadImage(url) : null);
    }),
  );

  for (let i = 0; i < width * height; i++) {
    const col = i % width;
    const row = Math.floor(i / width);
    const x = PADDING + col * (CELL + gap);
    const y = gridTop + row * (CELL + gap);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, CELL, CELL);

    const item = items.find((it) => it.position === i);
    if (!item) continue;

    const img = covers.get(item.album_spotify_id);
    if (img) ctx.drawImage(img, x, y, CELL, CELL);

    if (show_numbering) {
      const badge = Math.round(CELL * 0.2);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x, y, badge * 1.6, badge);
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.round(badge * 0.62)}px Geist, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x + badge * 0.3, y + badge / 2);
    }
  }

  if (hasList) {
    // 목록의 각 묶음이 대응하는 격자 행의 **위쪽**에서 시작한다. 항목은 자기 높이만
    // 차지하고 위에서부터 쌓이므로 행 아래에 빈 자리가 남을 수 있다 — 화면과 같은 규칙이다.
    // 글자는 잘라내지 않고 줄바꿈한다.
    const lx = PADDING + gridW + 32;
    const avail = LIST_WIDTH - 64;
    const fontSize = Math.max(18, Math.min(30, Math.round(CELL * 0.08)));
    const lineH = Math.round(fontSize * 1.3);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}px Geist, system-ui, sans-serif`;
    // 아티스트와 제목을 같은 색으로 둔다 — 색으로 나누는 대신 구분자만 쓴다.
    ctx.fillStyle = text_color;

    rows.forEach((row, r) => {
      let y = gridTop + r * (CELL + gap);
      row.forEach((item) => {
        const album = albums.get(item.album_spotify_id);
        const label = album ? `${album.subtitle} – ${album.title}` : '정보 없음';
        const text = show_numbering ? `${item.position + 1}. ${label}` : label;
        for (const line of wrapText(ctx, text, avail)) {
          ctx.fillText(line, lx, y + lineH / 2);
          y += lineH;
        }
      });
    });
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** 파일명에 못 쓰는 문자를 걷어낸다. 제목이 비면 'topster'. */
function safeName(title: string): string {
  const cleaned = title
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 60);
  return cleaned || 'topster';
}

export async function downloadTopsterImage(args: DrawArgs): Promise<void> {
  const blob = await renderTopsterBlob(args);
  if (!blob) throw new Error('canvas 렌더에 실패했습니다');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(args.title)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // click() 직후에 revoke 하면 브라우저가 아직 blob 을 읽기 전이라 다운로드가 취소된다
  // (헤드리스에서 파일이 아예 안 생기는 걸로 재현됨). 한참 뒤에 정리한다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
