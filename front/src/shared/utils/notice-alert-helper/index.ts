import Vue from 'vue';
import getRandomId from '@/shared/utils/uuid';

/** * @function
 *   @name showErrorMessage
 *   @param errorTitle
 *   @param errorMsg
 *   @returns
 */
export const showErrorMessage = (errorTitle: string, errorMsg: string) => {
  if (Vue) {
    Vue.notify({
      group: 'toastTopCenter',
      type: 'alert',
      title: errorTitle,
      text: errorMsg,
      duration: 5000,
      speed: 1000,
    });
  }
};

/**
 * Reduce whatever lands in a catch block to one human-readable message.
 *
 * useAxiosWrapper rejects HTTP failures with `{error, errorMsg, status}` — not an Error instance —
 * while a genuine exception thrown inside then() (a TypeError, say) arrives as a plain Error.
 * Reading `e.errorMsg.value` straight out of a catch therefore throws *again* on the second kind,
 * which leaves the screen stuck loading. Normalising here removes that secondary failure.
 */
export const toErrorMessage = (e: any, fallback: string): string => {
  const msg = e?.errorMsg;
  // Handles both the ref({value}) shape and a plain string.
  const unwrapped = msg && typeof msg === 'object' && 'value' in msg ? msg.value : msg;
  if (typeof unwrapped === 'string' && unwrapped) return unwrapped;
  if (typeof e?.message === 'string' && e.message) return e.message;
  return fallback;
};

/** * @function
 *   @name showSuccessMessage
 *   @param successTitle
 *   @param successMessage
 *   @returns
 */
export const showSuccessMessage = (
  successTitle: string,
  successMessage: string,
) => {
  if (Vue) {
    Vue.notify({
      group: 'toastTopCenter',
      type: 'success',
      title: successTitle,
      text: successMessage,
      duration: 5000,
      speed: 500,
    });
  }
};

/** * @function
 *   @name showLoadingMessage
 *   @param loadingTitle
 *   @param loadingMessage
 *   @parma id
 *   @param group
 *   @returns
 */
export const showLoadingMessage = (
  loadingTitle: string,
  loadingMessage: string,
  id?: string,
  group = 'toastTopCenter',
): string => {
  const uuid = getRandomId();
  if (Vue) {
    (Vue as any).notify({
      id: id ?? uuid,
      group,
      type: 'loading',
      title: loadingTitle,
      text: loadingMessage,
      duration: -1,
      speed: 500,
    });
  }
  return uuid;
};

/** * @function
 *   @name hideLoadingMessage
 *   @param group
 *   @returns
 */
export const hideLoadingMessage = (id: string) => {
  if (Vue) {
    if (id) (Vue.notify as any)?.close(id);
  }
};

// export const hideLoadingMessageByGroup = (group = 'toastTopCenter') => {
//     if (Vue) {
//         Vue.notify({
//             group,
//             clean: true,
//         });
//     }
// };

export const showInfoMessage = (infoTitle: string, infoText: string) => {
  if (Vue) {
    Vue.notify({
      group: 'toastTopCenter',
      type: 'info',
      title: infoTitle,
      text: infoText,
      duration: 5000,
      speed: 1000,
    });
  }
};
