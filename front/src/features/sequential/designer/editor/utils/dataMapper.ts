/**
 * Data mapping utility based on the Composite pattern
 * Maps a schema and data into a Composite Component structure
 */

import { SchemaAnalyzer } from './schemaAnalyzer';
import type { SchemaComponent, SchemaAnalysisResult } from '../types/schemaComponent';

export class DataMapper {
  /**
   * Maps a schema and data into a SchemaComponent
   */
  static mapSchemaToComponent(
    schema: any,
    data: any = {},
    name: string = 'field',
    path: string = ''
  ): SchemaComponent {
    const analysis = SchemaAnalyzer.analyzeSchema(schema, data);
    
    switch (analysis.type) {
      case 'string':
      case 'integer':
      case 'boolean':
        return this.createBasicTypeComponent(schema, data, name, analysis);
        
      case 'basicObject':
      case 'nestedObject':
        return this.createObjectComponent(schema, data, name, analysis, path);
        
      case 'basicArray':
      case 'basicObjectArray':
      case 'nestedObjectArray':
        return this.createArrayComponent(schema, data, name, analysis, path);
        
      default:
        return this.createBasicTypeComponent(schema, data, name, analysis);
    }
  }

  /**
   * Create a basic-type component
   */
  private static createBasicTypeComponent(
    schema: any,
    data: any,
    name: string,
    analysis: SchemaAnalysisResult
  ): SchemaComponent {
    return {
      type: analysis.type as 'string' | 'integer' | 'boolean',
      name,
      value: data !== undefined ? data : schema.default || '',
      isRequired: schema.required || false,
      description: schema.description,
      schema
    };
  }

  /**
   * Create an object-type component
   */
  private static createObjectComponent(
    schema: any,
    data: any,
    name: string,
    analysis: SchemaAnalysisResult,
    path: string
  ): SchemaComponent {
    const properties: Record<string, SchemaComponent> = {};
    
    // Iterate over the schema properties
    Object.entries(schema.properties || {}).forEach(([key, propSchema]: [string, any]) => {
      const propData = data && data[key] !== undefined ? data[key] : undefined;
      const propPath = path ? `${path}.${key}` : key;
      
      properties[key] = this.mapSchemaToComponent(propSchema, propData, key, propPath);
    });

    return {
      type: analysis.type as 'basicObject' | 'nestedObject',
      name,
      value: data,
      children: properties,
      schema,
      isRequired: schema.required || false,
      description: schema.description
    };
  }

  /**
   * Create an array-type component
   */
  private static createArrayComponent(
    schema: any,
    data: any,
    name: string,
    analysis: SchemaAnalysisResult,
    path: string
  ): SchemaComponent {
    const items: SchemaComponent[] = [];
    
    if (Array.isArray(data) && data.length > 0) {
      // When actual data exists
      data.forEach((item, index) => {
        const itemName = `item_${index}`;
        const itemPath = path ? `${path}[${index}]` : `[${index}]`;
        
        items.push(this.mapSchemaToComponent(schema.items, item, itemName, itemPath));
      });
    } else {
      // Create a template item
      const templateItem = this.mapSchemaToComponent(schema.items, {}, 'template_item', path);
      items.push(templateItem);
    }

    return {
      type: analysis.type as 'basicArray' | 'basicObjectArray' | 'nestedObjectArray',
      name,
      value: data,
      children: items,
      schema,
      isRequired: schema.required || false,
      description: schema.description
    };
  }

  /**
   * Create an empty object template
   */
  static createEmptyObjectTemplate(
    schema: any,
    name: string = 'object'
  ): SchemaComponent {
    const properties: Record<string, SchemaComponent> = {};
    
    Object.entries(schema.properties || {}).forEach(([key, propSchema]: [string, any]) => {
      properties[key] = this.mapSchemaToComponent(propSchema, undefined, key, key);
    });

    return {
      type: 'basicObject',
      name,
      value: {},
      children: properties,
      schema,
      isRequired: schema.required || false,
      description: schema.description
    };
  }

  /**
   * Create an empty array template
   */
  static createEmptyArrayTemplate(
    schema: any,
    name: string = 'array'
  ): SchemaComponent {
    const analysis = SchemaAnalyzer.analyzeSchema(schema, []);
    
    return {
      type: analysis.type as 'basicArray' | 'basicObjectArray' | 'nestedObjectArray',
      name,
      value: [],
      children: [],
      schema,
      isRequired: schema.required || false,
      description: schema.description
    };
  }

  /**
   * Validate data
   */
  static validateData(schema: any, data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!schema) {
      return { isValid: true, errors: [] };
    }

    // Validate required fields
    if (schema.required && Array.isArray(schema.required)) {
      schema.required.forEach((field: string) => {
        if (data === undefined || data === null || data[field] === undefined) {
          errors.push(`Required field '${field}' is missing.`);
        }
      });
    }

    // Validate types
    if (schema.type === 'string' && typeof data !== 'string') {
      errors.push(`Must be a string type.`);
    } else if (schema.type === 'integer' && typeof data !== 'number') {
      errors.push(`Must be an integer type.`);
    } else if (schema.type === 'boolean' && typeof data !== 'boolean') {
      errors.push(`Must be a boolean type.`);
    } else if (schema.type === 'object' && typeof data !== 'object') {
      errors.push(`Must be an object type.`);
    } else if (schema.type === 'array' && !Array.isArray(data)) {
      errors.push(`Must be an array type.`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert data (strings into their appropriate types)
   */
  static convertData(schema: any, data: any): any {
    if (!schema || data === undefined || data === null) {
      return data;
    }

    switch (schema.type) {
      case 'string':
        return String(data);
      case 'integer':
        return parseInt(data, 10);
      case 'boolean':
        return Boolean(data);
      case 'object':
        return typeof data === 'object' ? data : {};
      case 'array':
        return Array.isArray(data) ? data : [];
      default:
        return data;
    }
  }
}
