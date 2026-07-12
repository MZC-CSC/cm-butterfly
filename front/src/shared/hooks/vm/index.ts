import { IVm } from '@/entities/mci/model';

// An infra with no nodes yet (just created, or all nodes removed) arrives with no node/vm key
// at all. That is not an error, it just means "no nodes", so treat it as an empty list.
export function getCloudProvidersInVms(vms?: IVm[] | null) {
  const provider: { [key: string]: any } = {};

  (vms ?? []).forEach(vm => {
    const providerName = vm?.connectionConfig?.providerName;
    if (providerName) {
      provider[providerName] ||= providerColor(providerName);
    }
  });

  return Object.values(provider);
}

function providerColor(provider: string) {
  const upperCaseProvider = provider.toUpperCase();

  let color = '#EDEDEF';
  switch (upperCaseProvider) {
    case 'AWS':
      color = '#FF9900';
      break;
    case 'GOOGLE':
      color = '#4387F4';
      break;
    case 'AZURE':
      color = '#00BCF0';
      break;
    case 'NHN':
      color = '#125DE6';
      break;
  }

  return {
    name: provider,
    color: color,
  };
}
