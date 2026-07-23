import { insertDynamicComponent } from '@/shared/utils';
import { getSequencePath } from '@/features/sequential/designer/editor/model/utils';
import TaskComponentEditor from '@/features/sequential/designer/editor/ui/TaskComponentEditor.vue';
import ContainerNameEditor from '@/features/sequential/designer/editor/ui/ContainerNameEditor.vue';
import BashTaskEditor from '@/features/sequential/designer/editor/ui/BashTaskEditor.vue';
import SshTaskEditor from '@/features/sequential/designer/editor/ui/SshTaskEditor.vue';
import HttpXcomTaskEditor from '@/features/sequential/designer/editor/ui/HttpXcomTaskEditor.vue';
import TriggerWorkflowTaskEditor from '@/features/sequential/designer/editor/ui/TriggerWorkflowTaskEditor.vue';
import {
  isAutoOpenPropertiesEnabled,
  setAutoOpenPropertiesEnabled,
} from '@/features/sequential/designer/model/designerPreferences';

// cm-cicada task type → dedicated editor component. http (and unknown) falls
// back to the schema-driven TaskComponentEditor.
const TASK_TYPE_EDITOR: Record<string, any> = {
  bash: BashTaskEditor,
  ssh: SshTaskEditor,
  http_xcom: HttpXcomTaskEditor,
  trigger_workflow: TriggerWorkflowTaskEditor,
};

/**
 * Lock the value inputs — used in view-only mode.
 *
 * `<fieldset disabled>` is the standard behavior where the **browser** disables
 * the input, select, textarea and button elements inside it. It's shorter than
 * threading a readonly prop through every component, and leaves nothing to miss.
 *
 * We don't block it with CSS like `pointer-events: none` — that can be bypassed
 * by keyboard, and worse, it passes *silently without error*, so a value you
 * thought was locked still gets saved.
 *
 * It doesn't apply to non-native components, though, so trust this mode only
 * after confirming on screen that things are actually locked.
 */
function lockInputs(content: HTMLElement): HTMLElement {
  const locked = document.createElement('fieldset');
  locked.disabled = true;
  locked.className = 'sqd-editor-readonly';
  locked.style.border = 'none';
  locked.style.margin = '0';
  locked.style.padding = '0';
  locked.style.minWidth = '0';
  locked.appendChild(content);
  return locked;
}

export function editorProviders() {
  const editor = document.createElement('div');
  editor.style.width = '100%';
  editor.style.height = '100%';

  return {
    defaultRootEditorProvider: function (definition, rootContext, isReadonly) {
      // Preference setting. This value belongs to the *viewer*, not the
      // workflow, so it's kept in the browser rather than saved with the workflow.
      const settings = document.createElement('label');
      settings.className = 'sqd-designer-setting';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isAutoOpenPropertiesEnabled();
      checkbox.addEventListener('change', () => {
        setAutoOpenPropertiesEnabled(checkbox.checked);
      });
      const caption = document.createElement('span');
      caption.textContent = 'Open properties when a step is selected';
      settings.appendChild(checkbox);
      settings.appendChild(caption);
      editor.appendChild(settings);

      const textArea = document.createElement('textarea');
      textArea.style.width = '100%';
      textArea.style.height = 'calc(95% - 36px)';
      textArea.setAttribute('readonly', 'readonly');
      textArea.value = JSON.stringify(definition, null, 2);

      editor.appendChild(textArea);
      return editor;
    },
    defaultStepEditorProvider: function (
      step,
      stepContext,
      definition,
      isReadonly,
    ) {
      // Define the Vue component to build for each case
      if (step.componentType === 'switch' && step.type == 'if') {
        const ifEditor = document.createElement('div');
        ifEditor.className = 'sqd-editor-wrapper';
        ifEditor.innerHTML = `
          <div class="sqd-editor-header">If Step Settings</div>
          <div class="sqd-editor-body">
            <div class="sqd-editor-field">
              <label>Name:</label>
              <input type="text" id="if-name" value="${step.name}" style="width: 100%; padding: 8px; margin-top: 4px;" />
            </div>
            <p style="margin-top: 16px; color: #666;">Branches to the true or false branch depending on the condition.</p>
          </div>
        `;

        const nameInput = ifEditor.querySelector(
          '#if-name',
        ) as HTMLInputElement;
        nameInput?.addEventListener('input', e => {
          step.name = (e.target as HTMLInputElement).value;
          stepContext.notifyNameChanged();
        });

        editor.appendChild(ifEditor);
      }
      if (
        step.componentType === 'launchPad' ||
        step.componentType === 'container'
      ) {
        insertDynamicComponent(
          ContainerNameEditor,
          { step, definition },
          {
            saveComponentName: name => {
              step.name = name;
              stepContext.notifyNameChanged();
            },
          },
          editor,
        );
      }
      if (step.componentType === 'task') {
        // Pick a dedicated editor per cm-cicada task type (fall back to the generic TaskComponentEditor)
        const taskType = step.properties?.taskType;
        const TaskEditorComponent: any =
          (taskType && TASK_TYPE_EDITOR[taskType]) || TaskComponentEditor;

        console.log('=== Task Editor Selection ===');
        console.log('Step name:', step.name);
        console.log('Task type:', taskType);
        console.log(
          'Selected editor:',
          TaskEditorComponent?.name || 'TaskComponentEditor',
        );
        console.log('=============================');

        // See where toolboxModel does the processing
        insertDynamicComponent(
          TaskEditorComponent,
          { step },
          {
            saveComponentName: e => {
              step.name = e;
              stepContext.notifyNameChanged();
            },
            saveContext: e => {
              console.log('\n');
              console.log('💾💾💾 editorProviders.saveContext CALLED 💾💾💾');
              console.log('   Step name:', step.name);
              console.log('   Received model type:', typeof e);
              console.log('   Received model keys:', Object.keys(e || {}));

              // Deep inspection
              if (e && typeof e === 'object') {
                if (e.targetSoftwareModel && e.targetSoftwareModel.servers) {
                  console.log(
                    `   Received model.targetSoftwareModel.servers: array[${e.targetSoftwareModel.servers.length}]`,
                  );
                  if (e.targetSoftwareModel.servers.length > 0) {
                    console.log(
                      '   First server.source_connection_info_id:',
                      e.targetSoftwareModel.servers[0]
                        .source_connection_info_id,
                    );
                  }
                }
              }

              console.log(
                '   Received model JSON (first 500 chars):',
                JSON.stringify(e).substring(0, 500),
              );
              console.log(
                '   BEFORE: step.properties.model JSON (first 500 chars):',
                JSON.stringify(step.properties.model).substring(0, 500),
              );

              step.properties.model = e;

              console.log(
                '   AFTER: step.properties.model JSON (first 500 chars):',
                JSON.stringify(step.properties.model).substring(0, 500),
              );
              console.log('   ✅ step.properties.model updated');

              stepContext.notifyPropertiesChanged();
              console.log('   ✅ stepContext.notifyPropertiesChanged() called');
              console.log('💾💾💾 editorProviders.saveContext COMPLETE 💾💾💾');
              console.log('\n');
            },
            saveFixedModel: e => {
              step.properties.fixedModel = e;
              stepContext.notifyPropertiesChanged();
            },
          },
          editor,
        );
      }

      const label = document.createElement('label');
      label.innerText = getSequencePath(definition.sequence, step.id) ?? '';
      editor.appendChild(label);

      if (isReadonly) return lockInputs(editor);
      return editor;
    },
  };
}
