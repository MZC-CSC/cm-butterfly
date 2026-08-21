import type { APIRequestContext } from '@playwright/test';
import { config } from '../fixtures/test-data';

/**
 * Make a workflow with the same task chain as a template, and return its name.
 *
 * The Add button on the workflow list is disabled — workflows are composed from a target model, not
 * started blank — so a test that needs a *particular* chain of tasks on the canvas cannot get one
 * through that screen. The chain is what these scenarios are about (which tasks run before which), so
 * it is built here and opened with Edit, which is how someone returns to a workflow anyway.
 */
export async function seedWorkflowFromTemplate(opts: {
  request: APIRequestContext;
  token: string;
  templateName: string;
  name: string;
  baseURL?: string;
}): Promise<string> {
  const base = opts.baseURL ?? config.baseURL;
  const headers = {
    Authorization: `Bearer ${opts.token}`,
    'Content-Type': 'application/json',
  };

  const listed = await opts.request.post(
    `${base}/api/cm-cicada/list-workflow-template`,
    { headers, data: {} },
  );
  if (!listed.ok()) {
    throw new Error(`워크플로우 템플릿을 읽지 못했다 (${listed.status()})`);
  }
  const templates = (await listed.json())?.responseData ?? [];
  const template = templates.find(
    (t: { name?: string }) => t?.name === opts.templateName,
  );
  if (!template) {
    throw new Error(
      `"${opts.templateName}" 템플릿이 없다 — 있는 것: ${templates
        .map((t: { name?: string }) => t?.name)
        .join(', ')}`,
    );
  }

  const res = await opts.request.post(`${base}/api/cm-cicada/create-workflow`, {
    headers,
    data: { request: { name: opts.name, data: template.data } },
  });
  if (!res.ok()) {
    throw new Error(
      `워크플로우를 만들지 못했다 (${res.status()}): ${await res
        .text()
        .catch(() => '')}`,
    );
  }
  return (await res.json().catch(() => null))?.responseData?.id ?? '';
}

/**
 * Make a workflow of N tasks in a row, each with a request body to fill in.
 *
 * Every template starts with a lookup that sends no body, so a template cannot show what the first
 * task in a workflow looks like — there is no body section on it at all. `cicada_task_run_script`
 * takes four plain fields, so a chain of them gives a first task that has somewhere to put a value
 * and nowhere to take one from, which is the case worth seeing.
 */
export async function seedChainOfTasks(opts: {
  request: APIRequestContext;
  token: string;
  name: string;
  taskNames: string[];
  /** Component per position, where it should not be the script task — e.g. one that returns nothing. */
  components?: (string | undefined)[];
  /**
   * Fields already filled from an earlier task, per position — `{ ns_id: '${first_step.$.output}' }`.
   *
   * A workflow that arrives already using references is worth opening, because restoring them is
   * the part that fails quietly. The shipped templates used to give us one, then stopped: they
   * belong to cm-cicada and their task lineup changes with the lineup. Building our own keeps the
   * scenario standing on something we own.
   */
  references?: (Record<string, string> | undefined)[];
  baseURL?: string;
}): Promise<string> {
  const base = opts.baseURL ?? config.baseURL;
  const tasks = opts.taskNames.map((taskName, index) => {
    const component = opts.components?.[index] ?? 'cicada_task_run_script';
    return {
      name: taskName,
      task_component: component,
      // cm-cicada keeps the body under `spec`, which is also where templates and the console put it.
      spec:
        component === 'cicada_task_run_script'
          ? {
              request_body: JSON.stringify({
                content: 'ZWNobyBoaQ==',
                infra_id: '',
                node_id: '',
                ns_id: '',
                ...(opts.references?.[index] ?? {}),
              }),
            }
          : {},
      dependencies: index === 0 ? [] : [opts.taskNames[index - 1]],
    };
  });

  const res = await opts.request.post(`${base}/api/cm-cicada/create-workflow`, {
    headers: {
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
    },
    data: {
      request: {
        name: opts.name,
        data: {
          description: 'e2e — a straight chain of tasks',
          task_groups: [
            { name: 'chain', description: 'one after another', tasks },
          ],
        },
      },
    },
  });
  if (!res.ok()) {
    throw new Error(
      `태스크 ${opts.taskNames.length}개짜리 워크플로우를 만들지 못했다 (${res.status()}): ${await res
        .text()
        .catch(() => '')}`,
    );
  }
  return (await res.json().catch(() => null))?.responseData?.id ?? '';
}

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
                spec: {
                  request_body:
                    '{"content":"ZWNobyBoaQ==","infra_id":"${runs_later.$.output}","node_id":"n1","ns_id":"default"}',
                },
                dependencies: [],
              },
              {
                name: 'runs_later',
                task_component: 'cicada_task_time_sleep',
                spec: { request_body: '{"time":"1s"}' },
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
