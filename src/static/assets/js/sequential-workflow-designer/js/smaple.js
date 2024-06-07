
document.addEventListener('DOMContentLoaded', function() {
    const placeholder = document.getElementById('placeholder');

    const definition = {
    properties: {
        'myProperty': 'my-value',
        // root properties...
    },
    sequence: [
        // steps...
    ]
    };

    const configuration = {
    theme: 'light', // optional, default: 'light'
    isReadonly: false, // optional, default: false
    undoStackSize: 10, // optional, default: 0 - disabled, 1+ - enabled

    steps: {
        // all properties in this section are optional

        iconUrlProvider: (componentType, type) => {
        return `icon-${componentType}-${type}.svg`;
        },

        isDraggable: (step, parentSequence) => {
        return step.name !== 'y';
        },
        isDeletable: (step, parentSequence) => {
        return step.properties['isDeletable'];
        },
        isDuplicable: (step, parentSequence) => {
            return true;
        },
        canInsertStep: (step, targetSequence, targetIndex) => {
        return targetSequence.length < 5;
        },
        canMoveStep: (sourceSequence, step, targetSequence, targetIndex) => {
        return !step.properties['isLocked'];
        },
        canDeleteStep: (step, parentSequence) => {
        return step.name !== 'x';
        }
    },

    validator: {
        // all validators are optional

        step: (step, parentSequence, definition) => {
        return /^[a-z]+$/.test(step.name);
        },
        root: (definition) => {
        return definition.properties['memory'] > 256;
        }
    },

    toolbox: {
        isCollapsed: false,
        groups: [
        {
            name: 'Files',
            steps: [
            // steps for the toolbox's group
            ]
        },
        {
            name: 'Notification',
            steps: [
            // steps for the toolbox's group
            ]
        }
        ]
    },

    editors: {
        isCollapsed: false,
        rootEditorProvider: (definition, rootContext, isReadonly) => {
        const editor = document.createElement('div');
        // ...
        return editor;
        },
        stepEditorProvider: (step, stepContext, definition, isReadonly) => {
        const editor = document.createElement('div');
        // ...
        return editor;
        }
    },

    controlBar: true,
    contextMenu: true,
    };

    const designer = sequentialWorkflowDesigner.Designer.create(placeholder, definition, configuration);
    designer.onDefinitionChanged.subscribe((newDefinition) => {
    // ...
    });
});