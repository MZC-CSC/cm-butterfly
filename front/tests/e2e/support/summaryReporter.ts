import type {
  Reporter,
  FullResult,
  TestCase,
  TestResult,
  Suite,
} from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 시나리오별 정리 보고서 (한국어).
 *
 * Playwright 기본 HTML 리포트는 *개발자가 실패를 파고들기* 좋게 돼 있다. 그런데 우리가 필요한 건 하나 더 있다 —
 * **"어떤 시나리오가 있고, 각각 됐는지 안 됐는지, 그때 화면이 어땠는지"를 한눈에 훑는 문서.**
 * 릴리스 판단이나 리뷰 자리에서는 그게 훨씬 빨리 읽힌다.
 *
 * 그래서 기능(feature) → 시나리오 순으로 목차를 만들고, 각 시나리오에 성공/실패와 **실행 화면**을 붙인 단일 HTML을 낸다.
 * 브라우저에서 열어 그대로 인쇄(PDF)해도 된다.
 *
 * 켜고 끄기 — 기본은 켜짐. `E2E_SUMMARY_REPORT=0` 이면 만들지 않는다.
 * 출력 — `e2e-report/index.html` (이미지는 test-results 를 상대경로로 참조한다)
 */

interface Shot {
  name: string;
  src: string;
}

interface Row {
  feature: string;
  scenario: string;
  project: string;
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  durationSec: number;
  error?: string;
  shots: Shot[];
  /** 부하테스트 소요시간 같은 마크다운 첨부 */
  notes: string[];
}

const OUT_DIR = 'e2e-report';

export default class SummaryReporter implements Reporter {
  private rows: Row[] = [];
  private startedAt = 0;
  private enabled = process.env.E2E_SUMMARY_REPORT !== '0';

  onBegin(): void {
    this.startedAt = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.enabled) return;

    // playwright-bdd 는 "기능 › 시나리오" 구조로 suite 를 만든다. 파일명(.feature)에서 기능 이름을 얻는다.
    const feature = this.featureOf(test);
    const project = test.parent.project()?.name ?? '-';

    const shots: Shot[] = [];
    const notes: string[] = [];
    for (const a of result.attachments) {
      if (a.contentType === 'image/png' && a.path) {
        shots.push({ name: a.name, src: this.relative(a.path) });
      }
      if (a.contentType === 'text/markdown' && a.body) {
        notes.push(a.body.toString('utf8'));
      }
    }
    // 캡처 이름 앞에 번호를 붙여 두었으므로(01-before … 99-after) 그대로 정렬하면 실행 순서가 된다.
    shots.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    this.rows.push({
      feature,
      scenario: test.title,
      project,
      status: result.status === 'timedOut' ? 'failed' : (result.status as Row['status']),
      durationSec: Math.round(result.duration / 1000),
      error: result.error?.message
        ? this.stripAnsi(result.error.message).split('\n').slice(0, 6).join('\n')
        : undefined,
      shots,
      notes,
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    if (!this.enabled) return;
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, 'index.html');
    fs.writeFileSync(file, this.html(result), 'utf8');
    console.log(`\n📄 시나리오 보고서: ${file}  (브라우저에서 열면 그대로 인쇄/PDF 가능)`);
  }

  // ── 내부 ────────────────────────────────────────────────────────────────

  /** 생성된 spec 경로에서 기능 이름을 뽑는다: .../features/models/소스모델.feature.spec.js → 소스모델 */
  private featureOf(test: TestCase): string {
    const m = test.location.file.match(/features[/\\](.+)\.feature\.spec\.js$/);
    if (!m) return '기타';
    return m[1].replace(/\\/g, '/');
  }

  /** 보고서(e2e-report/)에서 이미지(test-results/)를 참조할 상대경로 */
  private relative(p: string): string {
    return path.relative(OUT_DIR, p).split(path.sep).join('/');
  }

  private stripAnsi(s: string): string {
    // eslint-disable-next-line no-control-regex
    return s.replace(/\[[0-9;]*m/g, '');
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** 마크다운 표를 간단히 HTML 로 (부하테스트 소요시간 첨부용 — 표·제목·목록만 다룬다) */
  private miniMarkdown(md: string): string {
    const out: string[] = [];
    let inTable = false;
    for (const raw of md.split('\n')) {
      const line = raw.trim();
      if (/^\|[\s-|:]+\|$/.test(line)) continue; // 표 구분선
      if (line.startsWith('|')) {
        const cells = line.split('|').slice(1, -1).map(c => this.esc(c.trim()));
        if (!inTable) {
          out.push('<table><tbody>');
          inTable = true;
        }
        out.push('<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>');
        continue;
      }
      if (inTable) {
        out.push('</tbody></table>');
        inTable = false;
      }
      if (line.startsWith('## ')) out.push(`<h4>${this.esc(line.slice(3))}</h4>`);
      else if (line.startsWith('# ')) out.push(`<h3>${this.esc(line.slice(2))}</h3>`);
      else if (line.startsWith('- ')) out.push(`<div class="li">• ${this.esc(line.slice(2))}</div>`);
      else if (line) out.push(`<p>${this.esc(line)}</p>`);
    }
    if (inTable) out.push('</tbody></table>');
    return out.join('\n');
  }

  private html(result: FullResult): string {
    const total = this.rows.length;
    const passed = this.rows.filter(r => r.status === 'passed').length;
    const failed = this.rows.filter(r => r.status === 'failed').length;
    const elapsed = Math.round((Date.now() - this.startedAt) / 1000);

    // 기능별로 묶는다
    const byFeature = new Map<string, Row[]>();
    for (const r of this.rows) {
      if (!byFeature.has(r.feature)) byFeature.set(r.feature, []);
      byFeature.get(r.feature)!.push(r);
    }

    const badge = (s: Row['status']) =>
      s === 'passed'
        ? '<span class="b ok">성공</span>'
        : s === 'failed'
          ? '<span class="b ng">실패</span>'
          : `<span class="b sk">${s}</span>`;

    const toc = [...byFeature.entries()]
      .map(([feature, rows]) => {
        const ng = rows.filter(r => r.status === 'failed').length;
        const items = rows
          .map(
            (r, i) =>
              `<li><a href="#${this.slug(feature)}-${i}">${this.esc(r.scenario)}</a> ${badge(r.status)}</li>`,
          )
          .join('');
        return `<li><a href="#${this.slug(feature)}"><b>${this.esc(feature)}</b></a> ${
          ng ? `<span class="b ng">${ng} 실패</span>` : '<span class="b ok">전부 성공</span>'
        }<ul>${items}</ul></li>`;
      })
      .join('');

    const sections = [...byFeature.entries()]
      .map(([feature, rows]) => {
        const body = rows
          .map((r, i) => {
            const shots = r.shots
              .map(
                s => `
        <figure>
          <a href="${s.src}" target="_blank"><img src="${s.src}" alt="${this.esc(s.name)}"></a>
          <figcaption>${this.esc(s.name)}</figcaption>
        </figure>`,
              )
              .join('');
            const err = r.error
              ? `<pre class="err">${this.esc(r.error)}</pre>`
              : '';
            const notes = r.notes.map(n => `<div class="note">${this.miniMarkdown(n)}</div>`).join('');
            return `
      <article id="${this.slug(feature)}-${i}" class="sc ${r.status}">
        <h3>${badge(r.status)} ${this.esc(r.scenario)}</h3>
        <div class="meta">${this.esc(r.project)} · ${r.durationSec}초</div>
        ${err}
        ${notes}
        <div class="shots">${shots || '<div class="muted">첨부된 화면 없음</div>'}</div>
      </article>`;
          })
          .join('');
        return `<section id="${this.slug(feature)}"><h2>${this.esc(feature)}</h2>${body}</section>`;
      })
      .join('');

    return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>cm-butterfly E2E 시나리오 보고서</title>
<style>
  :root { --ok:#137333; --ng:#c5221f; --line:#e0e0e0; }
  body { font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
         margin: 0 auto; max-width: 1100px; padding: 32px; color:#202124; line-height:1.6; }
  h1 { margin:0 0 4px; } h2 { margin-top:40px; padding-bottom:8px; border-bottom:2px solid var(--line); }
  h3 { margin:0 0 4px; font-size:17px; }
  .sum { display:flex; gap:24px; padding:16px 20px; background:#f8f9fa; border:1px solid var(--line);
         border-radius:8px; margin:16px 0 32px; }
  .sum div b { display:block; font-size:24px; }
  .b { display:inline-block; padding:1px 8px; border-radius:10px; font-size:12px; font-weight:600; color:#fff; }
  .b.ok { background:var(--ok); } .b.ng { background:var(--ng); } .b.sk { background:#9aa0a6; }
  nav ul { list-style:none; padding-left:16px; } nav > ul { padding-left:0; }
  nav li { margin:3px 0; } nav a { text-decoration:none; color:#1a73e8; }
  .sc { border:1px solid var(--line); border-left:4px solid var(--ok); border-radius:6px;
        padding:16px 20px; margin:16px 0; }
  .sc.failed { border-left-color:var(--ng); background:#fef7f7; }
  .meta { color:#5f6368; font-size:13px; margin-bottom:10px; }
  .err { background:#fce8e6; color:#a50e0e; padding:12px; border-radius:4px; overflow-x:auto;
         font-size:13px; white-space:pre-wrap; }
  .note { background:#f1f3f4; border-radius:4px; padding:8px 14px; margin:10px 0; font-size:13px; }
  .note table { border-collapse:collapse; } .note td { border:1px solid #dadce0; padding:3px 10px; }
  .note h3, .note h4 { margin:6px 0; font-size:14px; }
  .shots { display:flex; flex-wrap:wrap; gap:12px; margin-top:12px; }
  figure { margin:0; width:300px; }
  figure img { width:100%; border:1px solid var(--line); border-radius:4px; display:block; }
  figcaption { font-size:12px; color:#5f6368; margin-top:4px; text-align:center; }
  .muted { color:#9aa0a6; font-size:13px; }
  @media print { .sc { break-inside: avoid; } nav { break-after: page; } }
</style></head>
<body>
  <h1>cm-butterfly E2E 시나리오 보고서</h1>
  <div class="muted">${new Date().toLocaleString('ko-KR')} · 총 ${elapsed}초 · 전체 결과: ${result.status}</div>

  <div class="sum">
    <div><b>${total}</b>시나리오</div>
    <div><b style="color:var(--ok)">${passed}</b>성공</div>
    <div><b style="color:var(--ng)">${failed}</b>실패</div>
  </div>

  <h2 style="margin-top:0">목차</h2>
  <nav><ul>${toc}</ul></nav>

  ${sections}
</body></html>`;
  }

  private slug(s: string): string {
    return s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  }
}
