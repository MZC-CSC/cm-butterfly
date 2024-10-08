import Vue from 'vue';
import getRandomId from '../uuid';

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
