/**
 * Task Schema Loader Composable
 * Preloads and manages task schemas for the workflow editor.
 */

import { onMounted, onUnmounted } from 'vue';
import taskSchemaStore from '../store/taskSchemaStore';

export function useTaskSchemaLoader() {
  // Task schema store load state
  const isSchemaLoaded = taskSchemaStore.isSchemaLoaded;
  const isLoading = taskSchemaStore.loading;
  const error = taskSchemaStore.errorMessage;

  // Load task schemas from an existing API response
  const loadTaskSchemasFromResponse = (response: any) => {
    try {
      console.log('Loading task schemas from existing response...');
      taskSchemaStore.loadTaskSchemasFromResponse(response);
      console.log('Task schemas loaded from existing response successfully');
    } catch (error) {
      console.error('Failed to load task schemas from response:', error);
      throw error;
    }
  };

  // Load all task schemas (API call)
  const loadAllTaskSchemas = async () => {
    try {
      console.log('Loading all task schemas...');
      await taskSchemaStore.loadAllTaskSchemas();
      console.log('All task schemas loaded successfully');
    } catch (error) {
      console.error('Failed to load task schemas:', error);
      throw error;
    }
  };

  // Get the schema for a specific task
  const getTaskSchema = (taskName: string) => {
    return taskSchemaStore.getTaskSchema(taskName);
  };

  // Get the body_params schema for a specific task
  const getBodyParamsSchema = (taskName: string) => {
    return taskSchemaStore.getBodyParamsSchema(taskName);
  };

  // Get the list of all task names
  const getAllTaskNames = () => {
    return taskSchemaStore.getAllTaskNames();
  };

  // Reset the store
  const resetStore = () => {
    taskSchemaStore.reset();
  };

  // For debugging: print all schemas
  const debugPrintAllSchemas = () => {
    taskSchemaStore.debugPrintAllSchemas();
  };

  return {
    // State
    isSchemaLoaded,
    isLoading,
    error,
    
    // Methods
    loadTaskSchemasFromResponse,
    loadAllTaskSchemas,
    getTaskSchema,
    getBodyParamsSchema,
    getAllTaskNames,
    resetStore,
    debugPrintAllSchemas
  };
}
