<template>
  <div class="json-data-table-example">
    <h2 class="text-2xl font-bold mb-6">JSON Data Table Conversion Example</h2>
    
    <div class="mb-6">
      <h3 class="text-lg font-semibold mb-3">Migration Data Display</h3>
      <JsonDataTable 
        :json-data="migrationData" 
        :use-migration-format="true"
        :table-titles="['Server Info', 'Binary', 'Container', 'Kubernetes', 'Package', 'Software Model']"
      />
    </div>

    <div class="mb-6">
      <h3 class="text-lg font-semibold mb-3">General JSON Data Display</h3>
      <JsonDataTable 
        :json-data="generalData" 
        :use-migration-format="false"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import JsonDataTable from './JsonDataTable.vue';

export default defineComponent({
  name: 'JsonDataTableExample',
  components: {
    JsonDataTable
  },
  data() {
    return {
      migrationData: `{"targetSoftwareModel":{"servers":[{"errors":["No critical errors found"],"migration_list":{"binaries":[{"binary_path":"/usr/local/bin/app","custom_configs":["/etc/app/config.json"],"custom_data_paths":["/var/lib/app/data"],"name":"Sample Application","needed_libraries":["libssl-dev","libcurl4-openssl-dev"],"order":1,"version":"1.0.0"}],"containers":[{"container_id":"sample-container-1","container_image":{"image_architecture":"common","image_hash":"sha256:abc123def456","image_name":"sample-app","image_version":"latest"},"container_ports":[{"container_port":8080,"host_ip":"0.0.0.0","host_port":8080,"protocol":"tcp"}],"container_status":"running","docker_compose_path":"/opt/docker-compose.yml","envs":[{"name":"DB_HOST","value":"localhost"},{"name":"DB_PORT","value":"5432"}],"mount_paths":["/var/lib/app:/app/data"],"name":"sample-app-container","network_mode":"bridge","order":1,"restart_policy":"unless-stopped","runtime":"docker"}],"kubernetes":[{"kube_config":"/etc/kubernetes/admin.conf","order":1,"resources":{"deployment":{"replicas":3,"resources":{"limits":{"cpu":"500m","memory":"512Mi"},"requests":{"cpu":"100m","memory":"128Mi"}}}},"velero":{"backup_location_config":"default","bucket":"backup-bucket","features":"EnableCSI","plugins":"velero/velero-plugin-for-aws:v1.0.0","provider":"aws","secret_file":"/etc/velero/credentials"},"version":"1.24.0"}],"packages":[{"custom_configs":["/etc/nginx/nginx.conf"],"custom_data_paths":["/var/www/html"],"gpg_key_url":"https://nginx.org/keys/nginx_signing.key","name":"nginx","need_to_delete_packages":["apache2"],"needed_packages":["nginx","nginx-common"],"order":1,"repo_url":"http://nginx.org/packages/ubuntu","repo_use_os_version_code":false,"version":"1.18.0"}]},"source_connection_info_id":"conn-12345"}]},"softwareModel":{"id":"7b_COtxNSSeJgu8","name":"nfs-web-sw1-tg01","description":""}}`,
      
      generalData: {
        users: [
          { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
        ],
        settings: {
          theme: 'dark',
          language: 'ko',
          notifications: true
        },
        metadata: {
          version: '1.0.0',
          lastUpdated: '2024-01-15T10:30:00Z'
        }
      }
    };
  }
});
</script>

<style scoped>
.json-data-table-example {
  @apply p-6 bg-gray-50 min-h-screen;
}
</style>
