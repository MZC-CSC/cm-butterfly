import type { APIRequestContext } from '@playwright/test';
import { config } from '../fixtures/test-data';

/**
 * Create a workflow whose task reads a task that does not run before it.
 *
 * The editor cannot produce one of these — it only ever offers tasks that run first. But the engine
 * accepts any name that exists in the workflow, so an import, another tool, or a hand-edited file
 * can. That is exactly the case the notice on load exists for, so the test has to make one the same
 * way those do: through the API, not through the screen.
 *
 * `later` runs after `earlier`, and `earlier` reads a value out of `later`. At run time there is
 * nothing to read.
 */
export async function seedWorkflowWithBrokenReference(opts: {
  request: APIRequestContext;
  token: string;
  name: string;
  baseURL?: string;
}): Promise<string> {
  const base = opts.baseURL ?? config.baseURL;
  const headers = {
    Authorization: `Bearer ${opts.token}`,
    'Content-Type': 'application/json',
  };

  // The console wraps every proxied call in `request`; the proxy unwraps it. Same shape here.
  const body = {
    request: {
      name: opts.name,
      data: {
        description: 'e2e — reads a task that does not run first',
        task_groups: [
          {
            name: 'broken_group',
            description: 'the first task reads the second',
            tasks: [
              {
                name: 'reads_a_later_task',
                task_component: 'cicada_task_run_script',
                request_body:
                  '{"content":"ZWNobyBoaQ==","infra_id":"${runs_later.$.output}","node_id":"n1","ns_id":"default"}',
                dependencies: [],
              },
              {
                name: 'runs_later',
                task_component: 'cicada_task_time_sleep',
                request_body: '{"second":1}',
                dependencies: ['reads_a_later_task'],
              },
            ],
          },
        ],
      },
    },
  };

  const res = await opts.request.post(`${base}/api/cm-cicada/create-workflow`, {
    headers,
    data: body,
  });
  if (!res.ok()) {
    throw new Error(
      `잘못된 참조 워크플로우를 만들지 못했다 (${res.status()}): ${await res
        .text()
        .catch(() => '')}`,
    );
  }
  const created = await res.json().catch(() => null);
  return created?.responseData?.id ?? '';
}

/** Remove what the test made, so a rerun is not confused by the leftover. */
export async function deleteWorkflowById(opts: {
  request: APIRequestContext;
  token: string;
  id: string;
  baseURL?: string;
}): Promise<void> {
  if (!opts.id) return;
  const base = opts.baseURL ?? config.baseURL;
  await opts.request
    .post(`${base}/api/cm-cicada/delete-workflow`, {
      headers: { Authorization: `Bearer ${opts.token}` },
      data: { pathParams: { wfId: opts.id } },
    })
    .catch(() => undefined);
}
