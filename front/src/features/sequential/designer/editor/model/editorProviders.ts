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
 * 값 입력칸을 잠근다 — 보여주기만 하는 모드에서 쓴다.
 *
 * `<fieldset disabled>` 는 그 안의 input·select·textarea·button 을 **브라우저가**
 * 비활성화하는 표준 동작이다. 컴포넌트마다 readonly prop 을 뚫는 것보다 짧고
 * 빠뜨릴 자리가 없다.
 *
 * `pointer-events: none` 같은 CSS 로 가리지 않는다 — 키보드 조작에 뚫리고, 무엇보다
 * *에러 없이 조용히* 통과해 잠긴 줄 알았던 값이 저장된다.
 *
 * 다만 native 요소가 아닌 컴포넌트에는 듣지 않으므로, 이 모드는 화면에서 실제로
 * 잠기는지 확인한 뒤 믿는다.
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
      // 취향 설정. 워크플로우가 아니라 *보는 사람*에 딸린 값이라 워크플로우와 함께
      // 저장하지 않고 브라우저에 남긴다.
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
      //각각에 만들어야할 Vue component 정의
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
        // cm-cicada task type에 따라 전용 에디터 선택 (없으면 범용 TaskComponentEditor)
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

        //toolboxModel에서 가공하는곳 참고
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
