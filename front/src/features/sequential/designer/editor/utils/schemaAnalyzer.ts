/**
 * Composite Pattern-based schema analyzer.
 * Analyzes each type to determine the appropriate Composite Component type.
 */

import type { SchemaAnalysisResult } from '../types/schemaComponent';

export class SchemaAnalyzer {
  /**
   * Analyzes a schema and determines its type.
   */
  static analyzeSchema(schema: any, data: any = {}): SchemaAnalysisResult {
    if (!schema) {
      return {
        type: 'string',
        complexity: 'basic',
        hasNestedStructures: false
      };
    }

    // Analyze basic types
    if (this.isBasicType(schema)) {
      return {
        type: schema.type,
        complexity: 'basic',
        hasNestedStructures: false
      };
    }

    // Analyze object types
    if (schema.type === 'object' && schema.properties) {
      return this.analyzeObjectType(schema, data);
    }

    // Analyze array types
    if (schema.type === 'array' && schema.items) {
      return this.analyzeArrayType(schema, data);
    }

    // Default
    return {
      type: 'string',
      complexity: 'basic',
      hasNestedStructures: false
    };
  }

  /**
   * Checks whether it is a basic type.
   */
  private static isBasicType(schema: any): boolean {
    return ['string', 'integer', 'boolean'].includes(schema.type);
  }

  /**
   * Analyzes an object type.
   */
  private static analyzeObjectType(schema: any, data: any): SchemaAnalysisResult {
    const properties = Object.keys(schema.properties || {});
    let hasNestedStructures = false;
    let hasComplexTypes = false;

    // Analyze each property
    Object.values(schema.properties || {}).forEach((prop: any) => {
      if (prop.type === 'object' || prop.type === 'array') {
        hasNestedStructures = true;
      }
      
      // Check the actual data for complex structures
      if (data && typeof data === 'object') {
        Object.values(data).forEach((value: any) => {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            hasComplexTypes = true;
          }
        });
      }
    });

    const type = hasNestedStructures || hasComplexTypes ? 'nestedObject' : 'basicObject';
    const complexity = hasNestedStructures || hasComplexTypes ? 'complex' : 'composite';

    return {
      type,
      complexity,
      hasNestedStructures: hasNestedStructures || hasComplexTypes,
      properties
    };
  }

  /**
   * Analyzes an array type.
   */
  private static analyzeArrayType(schema: any, data: any): SchemaAnalysisResult {
    const items = Array.isArray(data) ? data : [];
    let hasNestedStructures = false;
    let hasComplexTypes = false;

    // Analyze the array item schema
    if (schema.items) {
      const itemAnalysis = this.analyzeSchema(schema.items, {});
      hasNestedStructures = itemAnalysis.hasNestedStructures;
      hasComplexTypes = itemAnalysis.type === 'nestedObject' || itemAnalysis.type === 'nestedObjectArray';
    }

    // Check the actual data for complex structures
    items.forEach((item: any) => {
      if (typeof item === 'object' && item !== null) {
        Object.values(item).forEach((value: any) => {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            hasComplexTypes = true;
          }
        });
      }
    });

    // Determine the array type
    let type: 'basicArray' | 'basicObjectArray' | 'nestedObjectArray' = 'basicArray';
    
    if (schema.items?.type === 'object') {
      type = hasNestedStructures || hasComplexTypes ? 'nestedObjectArray' : 'basicObjectArray';
    } else if (hasNestedStructures || hasComplexTypes) {
      type = 'nestedObjectArray';
    }

    const complexity = hasNestedStructures || hasComplexTypes ? 'complex' : 'composite';

    return {
      type,
      complexity,
      hasNestedStructures: hasNestedStructures || hasComplexTypes,
      itemCount: items.length
    };
  }

  /**
   * Returns the color for a given type.
   */
  static getTypeColor(type: string): string {
    const colorMap: Record<string, string> = {
      'string': '#059669',
      'integer': '#059669',
      'boolean': '#059669',
      'basicObject': '#3b82f6',
      'nestedObject': '#7c3aed',
      'basicArray': '#059669',
      'basicObjectArray': '#0ea5e9',
      'nestedObjectArray': '#dc2626'
    };
    
    return colorMap[type] || '#6b7280';
  }

  /**
   * Returns the icon for a given type.
   */
  static getTypeIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'string': '📝',
      'integer': '🔢',
      'boolean': '☑️',
      'basicObject': '📦',
      'nestedObject': '📋',
      'basicArray': '📋',
      'basicObjectArray': '📊',
      'nestedObjectArray': '🗂️'
    };
    
    return iconMap[type] || '❓';
  }

  /**
   * Returns the description for a given complexity level.
   */
  static getComplexityDescription(complexity: string): string {
    const descriptions: Record<string, string> = {
      'basic': 'Basic type - a simple value',
      'composite': 'Composite type - a combination of basic types',
      'complex': 'Complex type - includes nested structure'
    };
    
    return descriptions[complexity] || 'Unknown type';
  }
}
