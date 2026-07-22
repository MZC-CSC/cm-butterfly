import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Page } from '@playwright/test';

/**
 * Post-processing after a force delete — recording orphaned CSP resources.
 *
 * A force delete removes *only Tumblebug's internal records* and leaves the CSP resources (EC2 instances,
 * security groups, key pairs) in place. Once the records are gone there is no way to tell what remains, so we
 * take a **snapshot right before the delete** and, after the delete, include a "manual deletion required" list
 * in the result report. The leftover instances keep incurring charges, so without this record the cost leaks silently.
 *
 * The lookup calls the proxy API through the *app's authenticated session* (it does not access the linked frameworks directly).
 */

const OUT_DIR =
  process.env.ORPHAN_DIR ?? path.resolve(process.cwd(), 'test-results/orphans');

export interface OrphanSnapshot {
  nsId: string;
  infraId: string;
  capturedAt: string;
  status: string | null;
  nodes: Array<{
    nodeId: string;
    cspInstanceId: string | null;
    specId: string | null;
    sshKeyId: string | null;
    vNetId: string | null;
    subnetId: string | null;
    securityGroupIds: string[];
  }>;
}

function snapshotPath(infraId: string): string {
  return path.join(OUT_DIR, `${infraId}.snapshot.json`);
}

/** Called right before deletion — writes the CSP resource IDs used by the infra to a file. */
export async function snapshotCspResources(
  page: Page,
  nsId: string,
  infraId: string,
): Promise<OrphanSnapshot> {
  const res = await page.request.post('/api/cm-beetle/GetInfra', {
    data: { pathParams: { nsId, infraId } },
  });
  const body: any = await res.json().catch(() => ({}));
  const m =
    body?.responseData?.data ?? body?.data?.data ?? body?.data ?? body ?? {};

  const nodes = ((m.node ?? m.vm ?? []) as any[]).map(n => ({
    nodeId: n.id,
    cspInstanceId: n.cspResourceId ?? null, // the actual EC2 instance ID — the billable resource
    specId: n.specId ?? null,
    sshKeyId: n.sshKeyId ?? null,
    vNetId: n.vNetId ?? null,
    subnetId: n.subnetId ?? null,
    securityGroupIds: n.securityGroupIds ?? [],
  }));

  const snap: OrphanSnapshot = {
    nsId,
    infraId: m.id ?? infraId,
    capturedAt: new Date().toISOString(),
    status: m.status ?? null,
    nodes,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(snapshotPath(infraId), JSON.stringify(snap, null, 2));
  return snap;
}

/**
 * Called after a force delete — checks whether the instances from the snapshot are still alive on the CSP and builds a markdown report.
 * In an environment where the AWS CLI is unavailable, the liveness check is skipped and the snapshot contents are reported as "needs verification".
 */
export function orphanReport(infraId: string, reason: string): string {
  const p = snapshotPath(infraId);
  if (!fs.existsSync(p)) {
    return `### 후처리 — 고아 CSP 리소스 (${infraId})\n\n- 사유: ${reason}\n- ⚠️ 삭제 전 스냅샷이 없어 남은 자원을 특정할 수 없다. CSP 콘솔에서 직접 확인이 필요하다.\n`;
  }
  const snap: OrphanSnapshot = JSON.parse(fs.readFileSync(p, 'utf8'));
  const ids = snap.nodes.map(n => n.cspInstanceId).filter(Boolean) as string[];

  let alive: Array<{ Id: string; State: string }> | null = null;
  if (ids.length > 0) {
    try {
      const out = execFileSync(
        'aws',
        [
          'ec2',
          'describe-instances',
          '--region',
          process.env.AWS_REGION ?? 'ap-northeast-2',
          '--instance-ids',
          ...ids,
          '--query',
          'Reservations[].Instances[].{Id:InstanceId,State:State.Name}',
          '--output',
          'json',
        ],
        { encoding: 'utf8', env: { ...process.env, AWS_PAGER: '' } },
      );
      alive = (JSON.parse(out) as Array<{ Id: string; State: string }>).filter(
        i => !['terminated', 'shutting-down'].includes(i.State),
      );
    } catch {
      alive = null; // AWS lookup unavailable — reported as "needs verification" below.
    }
  }

  const lines: string[] = [];
  lines.push(`### 후처리 — 고아 CSP 리소스 (${snap.infraId})`);
  lines.push('');
  lines.push(`- 사유: ${reason}`);
  lines.push(`- 스냅샷 시각: ${snap.capturedAt}`);
  lines.push(`- 확인 시각: ${new Date().toISOString()}`);
  lines.push('');

  if (alive !== null && alive.length === 0) {
    lines.push(
      '**남은 인스턴스 없음** — CSP 자원까지 정리됐다. 수작업 삭제 불필요.',
    );
  } else {
    lines.push(
      alive === null
        ? '> ⚠️ **수작업 확인·삭제 필요** — CSP 생존 여부를 자동 확인하지 못했다. 아래 자원을 콘솔에서 직접 확인해야 한다.'
        : '> ⚠️ **수작업 삭제 필요** — 아래 자원은 Tumblebug 기록만 지워지고 CSP 에 그대로 살아 있다. 방치하면 계속 과금된다.',
    );
    lines.push('');
    lines.push('| 노드 | 인스턴스 ID | 현재 상태 | 스펙 |');
    lines.push('|------|-------------|-----------|------|');
    for (const n of snap.nodes) {
      const a = alive?.find(x => x.Id === n.cspInstanceId);
      if (alive !== null && !a) continue;
      lines.push(
        `| ${n.nodeId} | \`${n.cspInstanceId ?? '-'}\` | ${a?.State ?? '확인 필요'} | ${n.specId ?? '-'} |`,
      );
    }
    lines.push('');
    const shared = snap.nodes[0];
    if (shared) {
      lines.push(
        '함께 확인할 공유 자원(다른 인프라가 쓰지 않는다면 같이 정리):',
      );
      lines.push('');
      lines.push(
        `- SSH 키: \`${shared.sshKeyId ?? '-'}\` · VPC: \`${shared.vNetId ?? '-'}\` · 서브넷: \`${shared.subnetId ?? '-'}\` · 보안그룹: \`${shared.securityGroupIds.join(', ') || '-'}\``,
      );
    }
  }
  lines.push('');

  const md = lines.join('\n');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${infraId}.orphan-report.md`), md);
  return md;
}
