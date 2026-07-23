/**
 * Context type definitions — every possible Context type for the Grasshopper Task Editor.
 *
 * This file defines all Context types used by GrasshopperTaskEditor. It includes
 * the various Context types used to render hierarchical data into the UI.
 */

import { Ref } from 'vue';

// ============================================================================
// Base model types
// ============================================================================

/**
 * Base Input model type.
 * The type of the model returned by the useInputModel hook.
 */
export interface InputModel {
  value: Ref<string>;
  errorMessage: Ref<string | null>;
  isValid: Ref<boolean>;
  validating: Ref<boolean>;
  touched: Ref<boolean>;
  onBlur: () => Promise<void>;
  exeValidation: (newValue: string) => Promise<void>;
  debouncedValidate: any;
}

/**
 * Fixed model type (Path Params, Query Params).
 */
export interface FixedModel {
  path_params: Record<string, string>;
  query_params: Record<string, string>;
}

// ============================================================================
// Base Context types (smallest units)
// ============================================================================

/**
 * Input Context — a single input field.
 * The most basic Context type.
 */
export interface InputContext {
  type: 'input';
  context: {
    title: string;
    model: InputModel;
  };
}

/**
 * Key-Value Input Context — a key/value pair input field.
 * A field where the key and value can be entered dynamically.
 */
export interface KeyValueInputContext {
  type: 'keyValueInput';
  context: {
    title: InputModel;
    model: InputModel;
  };
}

/**
 * Key-Value Context — a simple key/value pair.
 * The base unit used within an ObjectArray.
 */
export interface KeyValueContext {
  type: 'keyValue';
  key: string;
  value: InputModel;
}

// ============================================================================
// Accordion-related Context types
// ============================================================================

/**
 * Accordion Slot Context — each slot inside an accordion.
 */
export interface AccordionSlotContext {
  header: {
    icon: string;
    title: string; // index
  };
  content: Array<InputContext>;
}

/**
 * Accordion Context — a Context rendered as an accordion.
 * Used to display array data as an accordion.
 */
export interface AccordionContext {
  type: 'accordion';
  context: {
    subject: string;
    values: Array<AccordionSlotContext>;
  };
  index: number;
  originalData: Array<any>;
}

// ============================================================================
// Params-related Context types
// ============================================================================

/**
 * Query Params Model — query parameters.
 */
export interface QueryParamsModel {
  type: 'params';
  context: {
    subject: 'Query_Params';
    values: Array<InputContext>;
  };
}

/**
 * Path Params Model — path parameters.
 */
export interface PathParamsModel {
  type: 'params';
  context: {
    subject: 'Path_Params';
    values: Array<InputContext>;
  };
}

/**
 * Params Context — the full parameter Context.
 */
export interface ParamsContext {
  path_params: PathParamsModel;
  query_params: QueryParamsModel;
}

// ============================================================================
// Entity-related Context types
// ============================================================================

/**
 * Entity Context — an entity Context.
 * Groups basic key/value pairs together.
 */
export interface EntityContext {
  type: 'entity';
  context: {
    subject: 'Entity';
    values: Array<InputContext | KeyValueInputContext>;
  };
}

// ============================================================================
// Nested-structure Context types
// ============================================================================

/**
 * Nested Object Context — a nested object Context.
 * For when an object contains other objects or arrays.
 */
export interface NestedObjectContext {
  type: 'nestedObject';
  context: {
    subject: string;
    values: Array<InputContext | NestedObjectContext | ArrayContext | ObjectArrayContext>;
  };
}

/**
 * Array Context — an array Context.
 * Handles array-shaped data.
 */
export interface ArrayContext {
  type: 'array';
  context: {
    subject: string;
    values: Array<InputContext | NestedObjectContext | ArrayContext | ObjectArrayContext>;
  };
  originalData: Array<any>;
}

/**
 * Object Array Context — an object-array Context.
 * A Context that handles an array of objects.
 */
export interface ObjectArrayContext {
  type: 'objectArray';
  subject: string;
  items: Array<ObjectContext>;
}

// ============================================================================
// Software Model-related Context types
// ============================================================================

/**
 * Software Model Context — a software-model Context.
 */
export interface SoftwareModelContext {
  type: 'softwareModel';
  context: {
    subject: 'Software Model';
    values: Array<InputContext>;
  };
}

// ============================================================================
// Object-related Context types (used in ObjectArray.vue)
// ============================================================================

/**
 * Object Context — an object Context.
 * The object unit used in ObjectArray.vue.
 */
export interface ObjectContext {
  type: 'object';
  subject: string;
  fields: Array<KeyValueContext | ObjectContext | ArrayContext | ObjectArrayContext | ComplexContext>;
}

/**
 * Complex Context — a composite Context.
 * A composite structure mixing various types.
 */
export interface ComplexContext {
  type: 'complex';
  subject: string;
  fields: Array<KeyValueContext | ObjectContext | ArrayContext | ObjectArrayContext | ComplexContext>;
}

// ============================================================================
// Form Context types
// ============================================================================

/**
 * Form Context — the top-level Form Context.
 */
export interface FormContext {
  type: 'form';
  subject: string;
  fields: Array<Context>;
}

/**
 * Converted Data — the converted-data type.
 * The converted data used in grasshopperTaskEditorModel.
 */
export type ConvertedData = 
  | EntityContext 
  | AccordionContext 
  | NestedObjectContext 
  | ArrayContext 
  | ObjectArrayContext 
  | SoftwareModelContext;

// ============================================================================
// Union types
// ============================================================================

/**
 * Union of all Context types.
 */
export type Context = 
  | KeyValueContext 
  | ObjectContext 
  | ArrayContext 
  | ObjectArrayContext 
  | ComplexContext
  | InputContext
  | KeyValueInputContext
  | NestedObjectContext
  | EntityContext
  | AccordionContext
  | SoftwareModelContext;

/**
 * Union of all Form Context types.
 */
export type FormContextType = 
  | EntityContext
  | ArrayContext
  | NestedObjectContext
  | ObjectArrayContext
  | AccordionContext
  | SoftwareModelContext;

// ============================================================================
// Utility types
// ============================================================================

/**
 * Type for the Context type-guard functions.
 */
export interface ContextTypeGuards {
  isInputContext(context: any): context is InputContext;
  isKeyValueContext(context: any): context is KeyValueContext;
  isObjectContext(context: any): context is ObjectContext;
  isArrayContext(context: any): context is ArrayContext;
  isObjectArrayContext(context: any): context is ObjectArrayContext;
  isNestedObjectContext(context: any): context is NestedObjectContext;
  isEntityContext(context: any): context is EntityContext;
  isAccordionContext(context: any): context is AccordionContext;
  isSoftwareModelContext(context: any): context is SoftwareModelContext;
}

/**
 * Type for the Context factory functions.
 */
export interface ContextFactory {
  createInputContext(title: string, value: string, depth?: number, valueType?: string): InputContext;
  createKeyValueContext(key: string, value: string): KeyValueContext;
  createKeyValueInputContext(): KeyValueInputContext;
  createObjectContext(subject: string, fields: Array<Context>): ObjectContext;
  createArrayContext(subject: string, values: Array<Context>, originalData?: Array<any>): ArrayContext;
  createObjectArrayContext(subject: string, values: Array<AccordionSlotContext>, originalData?: Array<any>): ObjectArrayContext;
  createNestedObjectContext(subject: string, values: Array<Context>): NestedObjectContext;
  createEntityContext(values: Array<InputContext | KeyValueInputContext>): EntityContext;
  createAccordionContext(subject: string, values: Array<AccordionSlotContext>, originalData?: Array<any>): AccordionContext;
  createSoftwareModelContext(values: Array<InputContext>): SoftwareModelContext;
  createFormContext(subject: string, fields: Array<Context>): FormContext;
}

/**
 * Type for the Context converter functions.
 */
export interface ContextConverter {
  convertToFormContext(data: any): FormContext;
  convertFromFormContext(formContext: FormContext): any;
  convertArrayContextToData(arrayContext: ArrayContext): any[];
  convertObjectArrayContextToData(objectArrayContext: ObjectArrayContext): any[];
  convertNestedObjectContextToData(nestedObjectContext: NestedObjectContext): any;
  convertEntityContextToData(entityContext: EntityContext): any;
  convertAccordionContextToData(accordionContext: AccordionContext): any[];
  convertSoftwareModelContextToData(softwareModelContext: SoftwareModelContext): any;
  validateContext(context: Context): boolean;
}

/**
 * Type for the Context editor functions.
 */
export interface ContextEditor {
  addField(context: ObjectContext | ComplexContext | NestedObjectContext, field: Context): void;
  removeField(context: ObjectContext | ComplexContext | NestedObjectContext, fieldIndex: number): void;
  updateField(context: ObjectContext | ComplexContext | NestedObjectContext, fieldIndex: number, field: Context): void;
  addArrayItem(context: ArrayContext | ObjectArrayContext, item: KeyValueContext | ObjectContext): void;
  removeArrayItem(context: ArrayContext | ObjectArrayContext, itemIndex: number): void;
  updateArrayItem(context: ArrayContext | ObjectArrayContext, itemIndex: number, item: KeyValueContext | ObjectContext): void;
  addAccordionSlot(context: AccordionContext, slot: AccordionSlotContext): void;
  removeAccordionSlot(context: AccordionContext, slotIndex: number): void;
  updateAccordionSlot(context: AccordionContext, slotIndex: number, slot: AccordionSlotContext): void;
}

// ============================================================================
// Depth-related types
// ============================================================================

/**
 * A Context that carries depth information.
 */
export interface DepthContext {
  depth: number;
  maxDepth: number;
  context: Context;
}

/**
 * Per-depth rendering options.
 */
export interface DepthRenderOptions {
  maxDepth: number;
  showDepthLabels: boolean;
  collapseNestedObjects: boolean;
  useObjectArrayForDepthZero: boolean;
}

// ============================================================================
// Validation-related types
// ============================================================================

/**
 * Context validation result.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/**
 * Context validation rule.
 */
export interface ValidationRule {
  field: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  message?: string;
}

// ============================================================================
// Event-related types
// ============================================================================

/**
 * Context change event.
 */
export interface ContextChangeEvent {
  type: 'add' | 'remove' | 'update' | 'move';
  context: Context;
  index?: number;
  oldValue?: any;
  newValue?: any;
}

/**
 * Context event handlers.
 */
export interface ContextEventHandler {
  onChange: (event: ContextChangeEvent) => void;
  onValidate: (context: Context, result: ValidationResult) => void;
  onError: (context: Context, error: Error) => void;
}

// ============================================================================
// Configuration-related types
// ============================================================================

/**
 * Context rendering configuration.
 */
export interface ContextRenderConfig {
  readonly: boolean;
  showValidation: boolean;
  showDepthLabels: boolean;
  maxDepth: number;
  useObjectArrayForDepthZero: boolean;
  customRenderers?: Record<string, any>;
}

/**
 * Context editing configuration.
 */
export interface ContextEditConfig {
  allowAdd: boolean;
  allowRemove: boolean;
  allowEdit: boolean;
  allowReorder: boolean;
  validationRules: Array<ValidationRule>;
}

// ============================================================================
// Constant definitions
// ============================================================================

/**
 * Context type constants.
 */
export const CONTEXT_TYPES = {
  INPUT: 'input',
  KEY_VALUE: 'keyValue',
  KEY_VALUE_INPUT: 'keyValueInput',
  OBJECT: 'object',
  ARRAY: 'array',
  OBJECT_ARRAY: 'objectArray',
  NESTED_OBJECT: 'nestedObject',
  ENTITY: 'entity',
  ACCORDION: 'accordion',
  SOFTWARE_MODEL: 'softwareModel',
  FORM: 'form',
  COMPLEX: 'complex',
  PARAMS: 'params'
} as const;

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: ContextRenderConfig = {
  readonly: false,
  showValidation: true,
  showDepthLabels: true,
  maxDepth: 5,
  useObjectArrayForDepthZero: true,
  customRenderers: {}
};

/**
 * Default editing configuration values.
 */
export const DEFAULT_EDIT_CONFIG: ContextEditConfig = {
  allowAdd: true,
  allowRemove: true,
  allowEdit: true,
  allowReorder: true,
  validationRules: []
};