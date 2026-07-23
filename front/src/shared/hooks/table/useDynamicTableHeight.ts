import { computed, Ref } from 'vue';


/**
 * Dynamic table height configuration
 */
export interface DynamicTableHeightConfig {
  tableRowHeight?: number;       // Table row height (default: 40px)
  tableHeaderHeight?: number;     // Table header height (default: 32px)
  toolboxHeight?: number;         // Toolbox area height (default: 81px)
  paginationHeight?: number;      // Pagination height (default: 0px - included in the toolbox)
  minTableHeight?: number;        // Minimum height - based on one row (default: 193px)
  maxTableHeight?: number;        // Maximum height - caps large data sets (default: 1000px)
  additionalPadding?: number;     // DataTable inner padding (default: 10px)
  enableLogging?: boolean;        // Enable debug logging (default: false)
}

/**
 * Dynamic table height return type
 */
export interface DynamicTableHeightReturn {
  dynamicHeight: Ref<number>;     // Dynamically computed height
  minHeight: number;              // Minimum height
  maxHeight: number;              // Maximum height
  config: Required<DynamicTableHeightConfig>; // Configuration values
}

/**
 * Calculate dynamic table height based on data count
 *
 * @param itemCount - Reactive reference to item count
 * @param pageSize - Reactive reference to page size
 * @param config - Optional configuration
 * @returns Dynamic height values
 *
 * @example
 * // Using the default configuration
 * const { dynamicHeight, minHeight, maxHeight } = useDynamicTableHeight(
 *   computed(() => tableModel.tableState.displayItems.length),
 *   computed(() => tableModel.tableOptions.pageSize)
 * );
 * 
 * @example
 * // Using a custom configuration
 * const { dynamicHeight, minHeight, maxHeight } = useDynamicTableHeight(
 *   computed(() => tableModel.tableState.displayItems.length),
 *   computed(() => tableModel.tableOptions.pageSize),
 *   {
 *     tableRowHeight: 60,
 *     additionalPadding: 20,
 *   }
 * );
 */
export function useDynamicTableHeight(
  itemCount: Ref<number>,
  pageSize: Ref<number>,
  config: DynamicTableHeightConfig = {},
): DynamicTableHeightReturn {
  // Set defaults (based on actual DOM measurements)
  const finalConfig: Required<DynamicTableHeightConfig> = {
    tableRowHeight: config.tableRowHeight ?? 40,        // Measured: 40px
    tableHeaderHeight: config.tableHeaderHeight ?? 32,   // Measured: 32px
    toolboxHeight: config.toolboxHeight ?? 81,          // Measured: 81px (includes pagination)
    paginationHeight: config.paginationHeight ?? 0,      // 0 because it is included in the toolbox
    minTableHeight: config.minTableHeight ?? 193,        // 81 + 32 + 40 + 40 = 193px (one row + DataTable inner padding)
    maxTableHeight: config.maxTableHeight ?? 1000,
    additionalPadding: config.additionalPadding ?? 10,   // DataTable inner padding
    enableLogging: config.enableLogging ?? false,
  };

  // Compute the dynamic height
  const dynamicHeight = computed(() => {
    // Stronger null/undefined checks
    const count = itemCount.value ?? 0;
    const size = pageSize.value ?? 15;

    // Return the minimum height when there is no data
    if (count === 0) {
      if (finalConfig.enableLogging) {
        console.log('[useDynamicTableHeight] No data, returning minTableHeight:', finalConfig.minTableHeight);
      }
      return finalConfig.minTableHeight;
    }

    // Number of rows actually displayed (the smaller of pageSize and the real data count)
    const displayRowCount = Math.min(count, size);

    // Calculated height = toolbox + header + (row height * row count) + pagination + extra padding
    const calculatedHeight =
      finalConfig.toolboxHeight +
      finalConfig.tableHeaderHeight +
      finalConfig.tableRowHeight * displayRowCount +
      finalConfig.paginationHeight +
      finalConfig.additionalPadding;

    const finalHeight = Math.min(calculatedHeight, finalConfig.maxTableHeight);

    if (finalConfig.enableLogging) {
      console.log('[useDynamicTableHeight] Calculation:', {
        itemCount: count,
        pageSize: size,
        displayRowCount,
        breakdown: {
          toolboxHeight: finalConfig.toolboxHeight,
          tableHeaderHeight: finalConfig.tableHeaderHeight,
          rowsHeight: finalConfig.tableRowHeight * displayRowCount,
          paginationHeight: finalConfig.paginationHeight,
          additionalPadding: finalConfig.additionalPadding,
        },
        calculatedHeight,
        finalHeight,
      });
    }

    // When there is data, only cap the maximum height (no minimum-height check)
    return finalHeight;
  });

  return {
    dynamicHeight,
    minHeight: finalConfig.minTableHeight,
    maxHeight: finalConfig.maxTableHeight,
    config: finalConfig,
  };
}

