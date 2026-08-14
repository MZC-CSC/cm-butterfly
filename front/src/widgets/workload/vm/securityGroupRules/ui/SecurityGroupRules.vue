<script setup lang="ts">
/**
 * The firewall rules of one security group, shown when the reader asks for them.
 *
 * Why it is not fetched with the node: the node detail is drawn from a list response already in
 * hand, so opening a node costs nothing. Rules need their own call, and calling per row is what
 * took this screen down with 429s once three infrastructures existed (BAR-1637).
 *
 * Why nothing is cached: a security group can change, and a cached copy cannot say that it did.
 * Someone opening this is asking what is open *now*. The call goes out only on a click, so it
 * comes nowhere near a rate limit - and leaving the screen and coming back asks again.
 *
 * Why a failure is spelled out: an empty panel reads as a bug. The reason is shown with a link
 * that retries this group alone, and the group folds back so the click can be repeated.
 */
import { ref } from 'vue';
import { useGetSecurityGroup } from '@/entities/mci/api';

interface IProps {
  nsId: string;
  securityGroupId: string;
}

const props = defineProps<IProps>();

interface IFirewallRule {
  Direction?: string;
  direction?: string;
  Protocol?: string;
  protocol?: string;
  Port?: string;
  Ports?: string;
  port?: string;
  CIDR?: string;
  cidr?: string;
}

const expanded = ref(false);
const loading = ref(false);
const rules = ref<IFirewallRule[]>([]);
const errorMessage = ref('');

/** Read a rule field without depending on which case the source used. */
function pick(rule: IFirewallRule, ...names: string[]): string {
  const bag = rule as Record<string, unknown>;
  for (const name of names) {
    const value = bag[name];
    if (value !== undefined && value !== null && value !== '')
      return String(value);
  }
  return '--';
}

/**
 * Say what went wrong in the reader's terms.
 *
 * ★ The rejection is not an axios error. `useAxiosWrapper` catches it and rejects with a bundle of
 *   refs - `{ error, errorMsg, status }` - so reaching for `error.response.status` finds nothing
 *   and every failure reads as the same flat sentence. The status has to be unwrapped from the ref
 *   inside that bundle. (Found by faking a 429 and getting the generic message back.)
 */
function describe(rejection: unknown): string {
  const bag = rejection as { error?: { value?: unknown } };
  const inner = (bag?.error?.value ?? rejection) as {
    response?: { status?: number };
  };
  const status = inner?.response?.status;

  if (status === 429) {
    return 'The server received too many requests.';
  }
  if (status) {
    return `The request failed (${status}).`;
  }
  return 'The request failed.';
}

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const { execute } = useGetSecurityGroup(props.nsId, props.securityGroupId);
    const response = await execute();
    const data = response?.data?.responseData ?? response?.data ?? {};
    rules.value = data.firewallRules ?? data.FirewallRules ?? [];
    expanded.value = true;
  } catch (error) {
    // Fold back so the same click can be repeated, and say why.
    expanded.value = false;
    rules.value = [];
    errorMessage.value = describe(error);
  } finally {
    loading.value = false;
  }
}

function toggle() {
  if (expanded.value) {
    expanded.value = false;
    rules.value = [];
    return;
  }
  void load();
}
</script>

<template>
  <div class="sg-rules">
    <button
      type="button"
      class="sg-toggle"
      :data-testid="`node-sg-toggle-${props.securityGroupId}`"
      :disabled="loading"
      @click="toggle"
    >
      <!--
        Down when closed, up when open.

        The rules open *below* the row, so the arrow points the way the panel will go - which is
        how an accordion reads. A right-pointing arrow says "there is more beside this" and left
        it unclear that anything would happen at all.
      -->
      <span class="caret">{{ expanded ? '▴' : '▾' }}</span>
      <span class="sg-name" :data-testid="`node-sg-${props.securityGroupId}`">{{
        props.securityGroupId
      }}</span>
      <span v-if="loading" class="hint">loading…</span>
    </button>

    <p
      v-if="errorMessage"
      class="sg-error"
      :data-testid="`node-sg-error-${props.securityGroupId}`"
    >
      {{ errorMessage }}
      <button
        type="button"
        class="sg-retry"
        :data-testid="`node-sg-retry-${props.securityGroupId}`"
        @click="load"
      >
        Try again
      </button>
    </p>

    <table v-if="expanded" class="sg-table">
      <thead>
        <tr>
          <th>Direction</th>
          <th>Protocol</th>
          <th>Port</th>
          <th>Target</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(rule, index) in rules"
          :key="index"
          :data-testid="`node-sg-rule-${props.securityGroupId}-${index}`"
        >
          <td>{{ pick(rule, 'Direction', 'direction') }}</td>
          <td>{{ pick(rule, 'Protocol', 'protocol') }}</td>
          <td
            :data-testid="`node-sg-rule-port-${props.securityGroupId}-${index}`"
          >
            {{ pick(rule, 'Ports', 'Port', 'port') }}
          </td>
          <td>{{ pick(rule, 'CIDR', 'cidr') }}</td>
        </tr>
        <tr v-if="!rules.length">
          <td colspan="4" class="empty">No rules</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.sg-rules {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.sg-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.caret {
  /*
    Loud enough to read as a control. Grey made it look like punctuation, and at 0.75rem the
    glyph came out smaller than the text beside it - so it read as a mark rather than a button.
  */
  color: #2563eb;
  font-size: 1.125rem;
  line-height: 1;
  font-weight: 700;
}
.sg-toggle:hover .caret,
.sg-toggle:hover .sg-name {
  color: #1d4ed8;
}
.sg-name {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.hint {
  color: #6b7280;
  font-size: 0.75rem;
}
.sg-error {
  color: #d32f2f;
  font-size: 0.8125rem;
}
.sg-retry {
  margin-left: 0.375rem;
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
}
.sg-table {
  border-collapse: collapse;
  font-size: 0.8125rem;
}
.sg-table th,
.sg-table td {
  border: 1px solid #e5e7eb;
  padding: 0.25rem 0.5rem;
  text-align: left;
  white-space: nowrap;
}
.empty {
  color: #6b7280;
}
</style>
