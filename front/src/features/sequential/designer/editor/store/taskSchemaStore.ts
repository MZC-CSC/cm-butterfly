/**
 * Task Schema Store
 * Preloads and manages the schema of every task from the list-task-component API
 */

import { ref, computed } from 'vue';
import { getTaskComponentList } from '@/features/sequential/designer/toolbox/model/api';
import type { ITaskComponentInfoResponse } from '@/features/sequential/designer/toolbox/model/api';
import { normalizeTaskComponentInPlace } from '@/entities/workflow/lib/schemaAdapter';

interface TaskSchema {
  name: string;
  description: string;
  body_params: {
    properties: Record<string, any>;
    required?: string[];
  };
  path_params: Record<string, any>;
  query_params: Record<string, any>;
}

class TaskSchemaStore {
  private taskSchemas = ref<Map<string, TaskSchema>>(new Map());
  private isLoading = ref(false);
  private isLoaded = ref(false);
  private error = ref<string | null>(null);

  // Computed properties
  get isSchemaLoaded() {
    return computed(() => this.isLoaded.value);
  }

  get loading() {
    return computed(() => this.isLoading.value);
  }

  get errorMessage() {
    return computed(() => this.error.value);
  }

  // load task schemas from an existing API response
  loadTaskSchemasFromResponse(response: any): void {
    if (this.isLoaded.value) {
      console.log('Task schemas already loaded');
      return;
    }

    this.isLoading.value = true;
    this.error.value = null;

    try {
      console.log('Loading task schemas from existing API response...');
      
      if (response?.responseData) {
        console.log(`Found ${response.responseData.length} task components`);
        
        response.responseData.forEach((taskComponent: ITaskComponentInfoResponse) => {
          // normalize the cm-cicada Type/Spec response into the legacy form (idempotent)
          normalizeTaskComponentInPlace(taskComponent);
          console.log(`Processing task component: ${taskComponent.name}`);
          console.log(`Has body_params:`, !!taskComponent.data?.body_params);
          
          if (taskComponent.data?.body_params) {
            const taskSchema: TaskSchema = {
              name: taskComponent.name,
              description: taskComponent.data.options?.request_body || '',
              body_params: taskComponent.data.body_params,
              path_params: taskComponent.data.path_params || {},
              query_params: taskComponent.data.query_params || {}
            };
            
            this.taskSchemas.value.set(taskComponent.name, taskSchema);
            console.log(`Loaded schema for task: ${taskComponent.name}`);
            console.log(`Schema properties:`, Object.keys(taskComponent.data.body_params.properties || {}));
            
            // special handling for tumblebug_mci_dynamic
            if (taskComponent.name === 'tumblebug_mci_dynamic') {
              console.log('=== tumblebug_mci_dynamic schema details ===');
              console.log('Body params:', taskComponent.data.body_params);
              console.log('Properties:', taskComponent.data.body_params.properties);
              console.log('==========================================');
            }
          } else {
            console.warn(`No body_params found for task: ${taskComponent.name}`);
          }
        });
        
        this.isLoaded.value = true;
        console.log(`Successfully loaded ${this.taskSchemas.value.size} task schemas`);
      } else {
        // if data is not ready yet (before async load), return quietly — it reloads later via the watch path
        console.warn('Task schemas: responseData not ready yet, skipping');
        return;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      this.error.value = errorMsg;
      console.error('Error loading task schemas:', errorMsg);
      throw err;
    } finally {
      this.isLoading.value = false;
    }
  }

  // load all task schemas (API call)
  async loadAllTaskSchemas(): Promise<void> {
    if (this.isLoaded.value) {
      console.log('Task schemas already loaded');
      return;
    }

    this.isLoading.value = true;
    this.error.value = null;

    try {
      console.log('Loading all task schemas from list-task-component API...');
      const { data: response } = await getTaskComponentList();
      this.loadTaskSchemasFromResponse(response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      this.error.value = errorMsg;
      console.error('Error loading task schemas:', errorMsg);
      throw err;
    }
  }

  // get the schema of a specific task
  getTaskSchema(taskName: string): TaskSchema | null {
    console.log(`Looking for schema for task: ${taskName}`);
    console.log(`Current loaded schemas:`, Array.from(this.taskSchemas.value.keys()));
    
    const schema = this.taskSchemas.value.get(taskName);
    if (schema) {
      console.log(`Found schema for task: ${taskName}`);
      console.log(`Schema properties:`, Object.keys(schema.body_params?.properties || {}));
      return schema;
    } else {
      console.warn(`No schema found for task: ${taskName}`);
      console.log(`Available task names:`, Array.from(this.taskSchemas.value.keys()));
      return null;
    }
  }

  // get the list of all task names
  getAllTaskNames(): string[] {
    return Array.from(this.taskSchemas.value.keys());
  }

  // get the body_params schema of a specific task
  getBodyParamsSchema(taskName: string): any {
    const schema = this.getTaskSchema(taskName);
    return schema?.body_params || null;
  }

  // get the path_params schema of a specific task
  getPathParamsSchema(taskName: string): any {
    const schema = this.getTaskSchema(taskName);
    return schema?.path_params || null;
  }

  // get the query_params schema of a specific task
  getQueryParamsSchema(taskName: string): any {
    const schema = this.getTaskSchema(taskName);
    return schema?.query_params || null;
  }

  // reset the store
  reset(): void {
    this.taskSchemas.value.clear();
    this.isLoading.value = false;
    this.isLoaded.value = false;
    this.error.value = null;
  }

  // for debugging: print all loaded schemas
  debugPrintAllSchemas(): void {
    console.log('=== Loaded Task Schemas ===');
    this.taskSchemas.value.forEach((schema, name) => {
      console.log(`Task: ${name}`);
      console.log(`  Description: ${schema.description}`);
      console.log(`  Body params properties:`, Object.keys(schema.body_params.properties || {}));
      console.log(`  Required fields:`, schema.body_params.required || []);
    });
    console.log('========================');
  }
}

// Singleton instance
const taskSchemaStore = new TaskSchemaStore();

export default taskSchemaStore;
export type { TaskSchema };
