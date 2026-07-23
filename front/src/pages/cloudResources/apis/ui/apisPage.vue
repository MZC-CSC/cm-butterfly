<!-- src/pages/cloudResources/apis/ui/apisPage.vue -->
<script setup lang="ts">
import { reactive } from 'vue';
import { PButton, PTextInput, PTextarea } from '@cloudforet-test/mirinae';
import { showSuccessMessage, showErrorMessage } from '@/shared/utils';
import JwtTokenProvider from '@/shared/libs/token';
import { DEFAULT_NAMESPACE } from '@/shared/constants/namespace';

// API test related state
const apiTestState = reactive({
  operationId: '',
  serviceName: '',
  method: '',
  resourcePath: '',
  pathParams: {} as Record<string, string>,
  queryParams: {} as Record<string, string>,
  requestBody: '',
  response: null as any,
  isLoading: false,
});

// For adding a new query parameter
const newQueryParam = reactive({
  key: '',
  value: '',
});

// API list state
const apiListState = reactive({
  services: [] as Array<{
    serviceName: string;
    actions: Array<{
      name: string;
      method: string;
      resourcePath: string;
      description: string;
    }>;
  }>,
  selectedService: '',
  selectedAction: '',
  filteredActions: [] as Array<{
    name: string;
    method: string;
    resourcePath: string;
    description: string;
  }>,
  operationIdInput: '',
  showSuggestions: false,
  filteredSuggestions: [] as Array<{
    name: string;
    method: string;
    resourcePath: string;
    description: string;
  }>,
});

// Load the API list
const loadApiList = async () => {
  try {
    // Get the auth token
    const tokenProvider = JwtTokenProvider.getProvider();
    const tokens = tokenProvider.getTokens();
    
    const headers: Record<string, string> = {};
    
    // If an auth token exists, add the Authorization header
    if (tokens.access_token) {
      headers['Authorization'] = `Bearer ${tokens.access_token}`;
    }
    
    const response = await fetch('/api/list', {
      headers,
    });
    const result = await response.json();
    
    if (result.success) {
      apiListState.services = result.data;
    } else {
      throw new Error(result.errorMessage || 'Failed to load API list');
    }
    
  } catch (error) {
    console.error('Failed to load API list:', error);
    showErrorMessage('Error', `Failed to load API list: ${(error as Error).message}`);
  }
};

// Service selection handler
const handleServiceSelect = (serviceName: string) => {
  apiListState.selectedService = serviceName;
  const selectedService = apiListState.services.find(s => s.serviceName === serviceName);
  if (selectedService) {
    apiListState.filteredActions = selectedService.actions;
  }
  apiListState.selectedAction = '';
  apiListState.operationIdInput = '';
  apiListState.showSuggestions = false;
  apiListState.filteredSuggestions = [];
};

// Action selection handler
const handleActionSelect = (actionName: string) => {
  apiListState.selectedAction = actionName;
  apiListState.operationIdInput = actionName;
  const selectedAction = apiListState.filteredActions.find(a => a.name === actionName);
  if (selectedAction) {
    apiTestState.operationId = actionName;
    apiTestState.serviceName = apiListState.selectedService;
    apiTestState.method = selectedAction.method;
    apiTestState.resourcePath = selectedAction.resourcePath;
    
    // Extract pathParams
    const pathParamMatches = selectedAction.resourcePath.match(/\{([^}]+)\}/g);
    if (pathParamMatches) {
      apiTestState.pathParams = {};
      pathParamMatches.forEach(match => {
        const paramName = match.slice(1, -1);
        // For the nsId parameter, default to DEFAULT_NAMESPACE
        apiTestState.pathParams[paramName] = paramName === 'nsId' ? DEFAULT_NAMESPACE : '';
      });
    }
  }
};

// Execute the API call
const executeApiCall = async () => {
  // If there's no operationId, take it from the input field
  if (!apiTestState.operationId && apiListState.operationIdInput) {
    apiTestState.operationId = apiListState.operationIdInput.trim();
  }
  
  if (!apiTestState.operationId) {
    showErrorMessage('Error', 'Please select an API operation');
    return;
  }
  
  apiTestState.isLoading = true;
  
  try {
    // Get the auth token
    const tokenProvider = JwtTokenProvider.getProvider();
    const tokens = tokenProvider.getTokens();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // If an auth token exists, add the Authorization header
    if (tokens.access_token) {
      headers['Authorization'] = `Bearer ${tokens.access_token}`;
    }
    
    // Build the data as a CommonRequest
    const commonRequest = {
      pathParams: apiTestState.pathParams,
      queryParams: apiTestState.queryParams,
      request: apiTestState.requestBody ? JSON.parse(apiTestState.requestBody) : null,
    };

    let response: Response;
    
    // When a service exists: use the /{subsystemName}/{operationId} form
    if (apiTestState.serviceName) {
      const url = `/api/${apiTestState.serviceName}/${apiTestState.operationId}`;
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(commonRequest),
      });
    } else {
      // When no service exists: use the /{operationId} form
      const url = `/api/${apiTestState.operationId}`;
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(commonRequest),
      });
    }
    
    const result = await response.json();
    
    // Convert to the existing API response shape
    apiTestState.response = {
      success: response.ok && result.status?.statusCode < 400,
      data: result,
      errorMessage: result.status?.message || (response.ok ? null : 'API call failed')
    };
    
    if (apiTestState.response.success) {
      showSuccessMessage('Success', 'API call executed successfully');
    } else {
      showErrorMessage('Error', apiTestState.response.errorMessage || 'API call failed');
    }
    
  } catch (error) {
    console.error('Failed to execute API call:', error);
    showErrorMessage('Error', 'Failed to execute API call');
    apiTestState.response = { 
      success: false, 
      errorMessage: (error as Error).message,
      data: null 
    };
  } finally {
    apiTestState.isLoading = false;
  }
};

// Add a query parameter
const addQueryParam = () => {
  if (newQueryParam.key && newQueryParam.value) {
    apiTestState.queryParams[newQueryParam.key] = newQueryParam.value;
    newQueryParam.key = '';
    newQueryParam.value = '';
  }
};

// Remove a query parameter
const removeQueryParam = (key: string) => {
  delete apiTestState.queryParams[key];
};

// Operation ID input handler
const handleOperationIdInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  apiListState.operationIdInput = value;
  
  if (value.length > 0) {
    // Build the suggestion list filtered by the entered text
    apiListState.filteredSuggestions = apiListState.filteredActions.filter(action =>
      action.name.toLowerCase().includes(value.toLowerCase())
    );
    apiListState.showSuggestions = apiListState.filteredSuggestions.length > 0;
  } else {
    apiListState.showSuggestions = false;
    apiListState.filteredSuggestions = [];
  }
};

// Suggestion item selection handler
const selectSuggestion = (action: any) => {
  apiListState.operationIdInput = action.name;
  apiListState.showSuggestions = false;
  handleActionSelect(action.name);
};

// Operation ID input field focus handler
const handleOperationIdFocus = () => {
  if (apiListState.operationIdInput.length > 0) {
    apiListState.showSuggestions = true;
  }
};

// Operation ID input field blur handler
const handleOperationIdBlur = () => {
  // Delay slightly so the click event is processed first
  setTimeout(() => {
    apiListState.showSuggestions = false;
  }, 200);
};

// Handle direct Operation ID entry
const handleOperationIdDirectInput = () => {
  const inputValue = apiListState.operationIdInput.trim();
  if (inputValue) {
    // Check whether the entered value is in the filtered action list
    const foundAction = apiListState.filteredActions.find(action => 
      action.name.toLowerCase() === inputValue.toLowerCase()
    );
    
    if (foundAction) {
      handleActionSelect(foundAction.name);
    } else {
      // Update the API test state with the directly entered operationId
      apiTestState.operationId = inputValue;
      apiTestState.serviceName = apiListState.selectedService;
      apiTestState.method = '';
      apiTestState.resourcePath = '';
      apiTestState.pathParams = {};
    }
  }
};

// Initialize
loadApiList();
</script>

<template>
  <div class="apis-page">
    <div class="page-header">
      <h1>API Test Console</h1>
      <p>Test backend APIs by selecting operation ID and configuring parameters</p>
    </div>

    <div class="api-test-container">
      <!-- API selection section -->
      <div class="api-selection-section">
        <h2>API Selection</h2>
        
        <div class="selection-row">
          <div class="form-group">
            <label>Service:</label>
            <select 
              v-model="apiListState.selectedService" 
              @change="handleServiceSelect(apiListState.selectedService)"
              class="form-select"
            >
              <option value="">Select Service</option>
              <option 
                v-for="service in apiListState.services" 
                :key="service.serviceName" 
                :value="service.serviceName"
              >
                {{ service.serviceName }}
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Operation ID:</label>
            <div class="autocomplete-container">
              <PTextInput 
                v-model="apiListState.operationIdInput"
                @input="handleOperationIdInput"
                @focus="handleOperationIdFocus"
                @blur="handleOperationIdBlur"
                @keydown.enter="handleOperationIdDirectInput"
                placeholder="Type or select operation ID"
                class="autocomplete-input"
                :disabled="!apiListState.selectedService"
              />
              <div 
                v-if="apiListState.showSuggestions && apiListState.filteredSuggestions.length > 0" 
                class="suggestions-dropdown"
              >
                <div 
                  v-for="action in apiListState.filteredSuggestions" 
                  :key="action.name"
                  class="suggestion-item"
                  @mousedown="selectSuggestion(action)"
                >
                  <div class="suggestion-name">{{ action.name }}</div>
                  <div class="suggestion-method">{{ action.method.toUpperCase() }}</div>
                  <div class="suggestion-description">{{ action.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected API information -->
        <div v-if="apiTestState.operationId" class="selected-api-info">
          <h3>Selected API Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Operation ID:</label>
              <span>{{ apiTestState.operationId }}</span>
            </div>
            <div class="info-item">
              <label>Service:</label>
              <span>{{ apiTestState.serviceName }}</span>
            </div>
            <div class="info-item">
              <label>Method:</label>
              <span class="method-badge" :class="apiTestState.method.toLowerCase()">
                {{ apiTestState.method.toUpperCase() }}
              </span>
            </div>
            <div class="info-item">
              <label>Resource Path:</label>
              <span class="resource-path">{{ apiTestState.resourcePath }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- API test section -->
      <div v-if="apiTestState.operationId" class="api-test-section">
        <h2>API Test Configuration</h2>
        
        <!-- Path Parameters -->
        <div v-if="Object.keys(apiTestState.pathParams).length > 0" class="param-section">
          <h3>Path Parameters</h3>
          <div class="param-grid">
            <div 
              v-for="(value, key) in apiTestState.pathParams" 
              :key="key" 
              class="param-item"
            >
              <label>{{ key }}:</label>
              <PTextInput 
                v-model="apiTestState.pathParams[key]"
                :placeholder="`Enter ${key}`"
              />
            </div>
          </div>
        </div>

        <!-- Query Parameters -->
        <div class="param-section">
          <h3>Query Parameters</h3>
          <div class="param-grid">
            <div class="param-item">
              <label>Add Query Parameter:</label>
              <div class="add-param-row">
                <PTextInput 
                  v-model="newQueryParam.key"
                  placeholder="Parameter name"
                  class="param-input"
                />
                <PTextInput 
                  v-model="newQueryParam.value"
                  placeholder="Parameter value"
                  class="param-input"
                />
                <PButton 
                  @click="addQueryParam"
                  size="sm"
                  style="primary"
                >
                  Add
                </PButton>
              </div>
            </div>
          </div>
          <div v-if="Object.keys(apiTestState.queryParams).length > 0" class="existing-params">
            <div 
              v-for="(value, key) in apiTestState.queryParams" 
              :key="key" 
              class="existing-param"
            >
              <span class="param-name">{{ key }}:</span>
              <span class="param-value">{{ value }}</span>
              <PButton 
                @click="removeQueryParam(key)"
                size="xs"
                style="destructive"
              >
                Remove
              </PButton>
            </div>
          </div>
        </div>

        <!-- Request Body -->
        <div v-if="['POST', 'PUT', 'PATCH'].includes(apiTestState.method)" class="param-section">
          <h3>Request Body</h3>
          <PTextarea 
            v-model="apiTestState.requestBody"
            placeholder="Enter JSON request body"
            rows="8"
            class="request-body"
          />
        </div>

        <!-- Execute Button -->
        <div class="execute-section">
          <PButton 
            @click="executeApiCall"
            :loading="apiTestState.isLoading"
            size="lg"
            style="primary"
          >
            Execute API Call
          </PButton>
        </div>
      </div>

      <!-- Response Section -->
      <div v-if="apiTestState.response" class="response-section">
        <h2>Response</h2>
        <div class="response-container">
          <pre class="response-json">{{ JSON.stringify(apiTestState.response, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.apis-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}

.page-header p {
  color: #6b7280;
  font-size: 16px;
}

.api-test-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.api-selection-section,
.api-test-section,
.response-section {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.api-selection-section h2,
.api-test-section h2,
.response-section h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16px;
}

.selection-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 500;
  color: #374151;
}

.form-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.selected-api-info {
  background: #f9fafb;
  border-radius: 6px;
  padding: 16px;
}

.selected-api-info h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
}

.info-item span {
  font-size: 14px;
  color: #1f2937;
}

.method-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.method-badge.get {
  background: #dcfce7;
  color: #166534;
}

.method-badge.post {
  background: #dbeafe;
  color: #1e40af;
}

.method-badge.put {
  background: #fef3c7;
  color: #92400e;
}

.method-badge.delete {
  background: #fee2e2;
  color: #dc2626;
}

.resource-path {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.autocomplete-container {
  position: relative;
  width: 100%;
}

.autocomplete-input {
  width: 100%;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #d1d5db;
  border-top: none;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
}

.suggestion-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.2s;
}

.suggestion-item:hover {
  background-color: #f9fafb;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 14px;
  margin-bottom: 4px;
}

.suggestion-method {
  display: inline-block;
  padding: 2px 6px;
  background: #e5e7eb;
  color: #374151;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 4px;
}

.suggestion-description {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.param-section {
  margin-bottom: 24px;
}

.param-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.param-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.param-item label {
  font-weight: 500;
  color: #374151;
}

.add-param-row {
  display: flex;
  gap: 8px;
  align-items: end;
}

.param-input {
  flex: 1;
}

.existing-params {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.existing-param {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.param-name {
  font-weight: 500;
  color: #374151;
  min-width: 120px;
}

.param-value {
  flex: 1;
  color: #6b7280;
}

.request-body {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

.execute-section {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

.response-container {
  background: #1f2937;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
}

.response-json {
  color: #f9fafb;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
