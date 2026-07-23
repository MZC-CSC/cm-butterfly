import { ref, computed, onMounted, onUnmounted, nextTick, Ref, ComputedRef } from 'vue';

/**
 * Toolbox table height configuration options
 */
export interface ToolboxTableHeightOptions {
  defaultToolboxHeight?: number;      // default toolbox height (default: 81px)
  pHorizontalLayoutOffset?: number;   // PHorizontalLayout internal fixed height (default: 44px)
  debounceDelay?: number;             // debounce delay (default: 150ms)
  enableLogging?: boolean;            // enable debug logging (default: false)
}

/**
 * Toolbox table height return type
 */
export interface ToolboxTableHeightReturn {
  toolboxTableRef: Ref<any>;              // toolbox table component reference
  adjustedDynamicHeight: ComputedRef<number>; // adjusted dynamic height
}

/**
 * Calculate and manage dynamic toolbox table height with responsive adjustment.
 *
 * This composable handles automatic height adjustment of PToolboxTable when the toolbox area
 * wraps to multiple lines due to screen width changes, sidebar toggles, or dev tools.
 *
 * @param baseDynamicHeight - Base dynamic height from useDynamicTableHeight (accepts both Ref and ComputedRef)
 * @param options - Optional configuration
 * @returns Toolbox table reference and adjusted height
 *
 * @example
 * // Basic usage
 * const { dynamicHeight } = useDynamicTableHeight(
 *   computed(() => tableModel.tableState.items.length),
 *   computed(() => tableModel.tableOptions.pageSize)
 * );
 *
 * const { toolboxTableRef, adjustedDynamicHeight } = useToolboxTableHeight(dynamicHeight);
 *
 * // Use in the template:
 * // <PHorizontalLayout :height="adjustedDynamicHeight">
 * //   <PToolboxTable ref="toolboxTableRef" ... />
 * // </PHorizontalLayout>
 *
 * @example
 * // Using custom settings
 * const { toolboxTableRef, adjustedDynamicHeight } = useToolboxTableHeight(
 *   dynamicHeight,
 *   {
 *     defaultToolboxHeight: 100,
 *     pHorizontalLayoutOffset: 120,
 *     debounceDelay: 200,
 *     enableLogging: true
 *   }
 * );
 */
export function useToolboxTableHeight(
  baseDynamicHeight: Ref<number> | ComputedRef<number>,
  options: ToolboxTableHeightOptions = {},
): ToolboxTableHeightReturn {
  // Set defaults
  const finalOptions = {
    defaultToolboxHeight: options.defaultToolboxHeight ?? 81,
    pHorizontalLayoutOffset: options.pHorizontalLayoutOffset ?? 44,
    debounceDelay: options.debounceDelay ?? 150,
    enableLogging: options.enableLogging ?? false,
  };

  // Internal state management
  const toolboxTableRef = ref<any>(null);
  const actualToolboxHeight = ref(finalOptions.defaultToolboxHeight);
  let resizeTimeout: NodeJS.Timeout | null = null;
  let resizeObserver: ResizeObserver | null = null;

  /**
   * Measure actual toolbox height from DOM
   */
  const updateToolboxHeight = () => {
    if (!toolboxTableRef.value?.$el) return;

    const toolboxElement = toolboxTableRef.value.$el.querySelector(
      '.p-toolbox-table .top-wrapper',
    );

    if (toolboxElement) {
      const height = toolboxElement.getBoundingClientRect().height;
      actualToolboxHeight.value = height;

      if (finalOptions.enableLogging) {
        console.log('[useToolboxTableHeight] Toolbox height measured:', height);
      }
    }
  };

  /**
   * Debounced resize handler
   */
  const handleResize = () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    resizeTimeout = setTimeout(() => {
      updateToolboxHeight();
    }, finalOptions.debounceDelay);
  };

  /**
   * Adjusted dynamic height calculation.
   *
   * Adds the difference between actual and default toolbox height,
   * plus the PHorizontalLayout internal offset.
   */
  const adjustedDynamicHeight = computed(() => {
    const baseHeight = baseDynamicHeight.value;
    const toolboxDiff = actualToolboxHeight.value - finalOptions.defaultToolboxHeight;
    const finalHeight = baseHeight + toolboxDiff + finalOptions.pHorizontalLayoutOffset;

    if (finalOptions.enableLogging) {
      console.log(
        '[useToolboxTableHeight] Height recalculated - Base:',
        baseHeight,
        'Toolbox:',
        actualToolboxHeight.value,
        'Offset:',
        finalOptions.pHorizontalLayoutOffset,
        'Final:',
        finalHeight,
      );
    }

    return finalHeight;
  });

  // Initialize when the component mounts
  onMounted(() => {
    nextTick(() => {
      updateToolboxHeight();

      // Register a ResizeObserver to detect toolbox container size changes
      if (toolboxTableRef.value?.$el) {
        resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(toolboxTableRef.value.$el);

        if (finalOptions.enableLogging) {
          console.log('[useToolboxTableHeight] ResizeObserver registered for toolbox container');
        }
      }

      // Also add a window resize event (backup for ResizeObserver)
      window.addEventListener('resize', handleResize);
      if (finalOptions.enableLogging) {
        console.log('[useToolboxTableHeight] Window resize listener registered');
      }
    });
  });

  // Clean up when the component unmounts
  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    window.removeEventListener('resize', handleResize);

    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    if (finalOptions.enableLogging) {
      console.log('[useToolboxTableHeight] Cleanup completed');
    }
  });

  return {
    toolboxTableRef,
    adjustedDynamicHeight,
  };
}

