# Components

## Organization

All components live under `app/components/`. Nuxt auto-imports them by path — a component at `components/Modals/Folder/CreateFolderModal.vue` is available as `<CreateFolderModal />` (when the name is globally unique).

## Naming Conventions

| Rule                                  | Example                             |
| ------------------------------------- | ----------------------------------- |
| PascalCase for all files              | `DesignerSection.vue`               |
| Domain prefix for grouped components  | `Designer*`, `Panel*`, `Page*`      |
| `Modal` suffix for all modal dialogs  | `CreateFolderModal.vue`             |
| `_partial/` directories for sub-views | Not standalone navigable components |

## Component Tree

```
components/
├── [Standalone utilities]
│   ├── AvatarPanel.vue          User avatar + name display
│   ├── CodeEditor.vue           Monaco-based code editor
│   ├── DatePicker.vue           Date picker
│   ├── DraggableElement.vue     @vue-dnd-kit drag wrapper
│   ├── ExtendableSlot.vue       Dynamic slot injection (useExtendableSlotsStore)
│   ├── LiquidGlass.vue          Visual effect component
│   ├── NaviBar.vue              Top navigation bar
│   ├── PageCalendar.vue         FullCalendar integration
│   ├── PrettyPageContainer.vue  Styled page wrapper
│   ├── QuestionnaireEngineEditor.vue  Engine editing UI
│   ├── QuestionnaireScheduler.vue     Schedule management
│   ├── RTEditor.vue             Tiptap rich text editor
│   ├── ResizablePanel.vue       Drag-resizable panel splitter
│   └── ScrollableContainer.vue  Simplebar-based scroll wrapper
│
├── Designer/                    Questionnaire designer components
│   └── QuestionnairePreview.vue  Live preview using the engine
├── FolderTree/
│   └── FolderTree.vue           Recursive folder hierarchy
├── Forms/
│   └── ChangePasswordForm.vue
├── Grid/
│   ├── Grid.vue                 Card grid layout
│   ├── FolderGrid.vue           Folder-specific grid
│   ├── GridElementWrapper.vue   Single grid card
│   ├── GridIcon.vue             Icon with type indicator
│   └── DetailsPanel.vue         Side panel with entity details
├── Input/
│   └── PasswordInput.vue        Password field with show/hide toggle
├── JsonForms/
│   ├── JsonForms.vue            @jsonforms/vue-vanilla wrapper
│   ├── JsonFormSubmit.vue       Submit button for JSON forms
│   └── renderers/               Custom cell renderers
│       ├── ArrayRenderer.vue
│       ├── CheckboxRenderer.vue
│       ├── DateRenderer.vue
│       ├── MultiSelectRenderer.vue
│       ├── NumberRenderer.vue
│       ├── RadioRenderer.vue
│       ├── SelectMenuRenderer.vue
│       ├── SelectRenderer.vue
│       ├── SliderRenderer.vue
│       ├── StringRenderer.vue
│       ├── TextareaRenderer.vue
│       └── ToggleRenderer.vue
├── Modals/
│   ├── ConfirmModal.vue         Generic confirm dialog
│   ├── JsonFormModal.vue        Modal wrapping a JSON form
│   ├── ModalWrapper.vue         Base modal shell
│   ├── AuthenticateDevice/
│   │   └── AuthenticateDeviceModal.vue
│   ├── Designer/                Designer-specific modals
│   │   ├── EditQuestionnaireScheduleModal/
│   │   ├── PreviewQuestionnaireModal.vue
│   │   ├── PublishQuestionnaireModal.vue
│   │   └── SubmissionPreviewModal.vue
│   ├── EnrollPatient/
│   ├── Folder/
│   │   ├── CreateFolderModal.vue
│   │   └── CreateFolderPermissionModal.vue
│   ├── Patient/
│   ├── Questionnaire/
│   │   ├── CreateQuestionnaireModal.vue
│   │   └── CreateQuestionnairePermissionModal.vue
│   └── User/
├── Page/
│   ├── PageContainer.vue        Outer container with padding
│   ├── PageHeader.vue           Title + breadcrumb + tabs + actions
│   ├── Logo.vue
│   └── Section/PageSection.vue  Labeled section with divider
├── Panel/
│   └── Panel.vue
├── PanelActionCard.vue
├── PanelActionSection.vue
├── PanelChangesFooter.vue       Save/discard footer (shown when isChanged)
├── PanelContent.vue
├── PanelHeader.vue
├── PanelSection.vue
├── Scoring/
│   ├── ScoringDesigner.vue
│   └── ScoringConditionEditor.vue
├── Sidepanel/
│   ├── Sidepanel.vue            Collapsible left nav
│   └── SidepanelMenuElement.vue
├── Submission/
│   └── SubmissionPreview.vue    Read-only submission view
├── Table/
│   ├── Table.vue                Data table
│   └── EmptyContainer.vue       Empty state slot wrapper
└── Tabs/
    ├── Tabs.vue
    └── Tab.vue
```

## Common Patterns

### Props Destructuring Disabled

`vue.propsDestructure: false` in `nuxt.config.ts`. Always access props as `props.xxx`, not destructured:

```typescript
// WRONG
const { id, title } = props;

// CORRECT
console.log(props.id, props.title);
```

### Modal Pattern

Modals are created programmatically in stores, not placed in templates:

```typescript
// In store:
const modal = overlay.create(SomeModal);
await modal.open({ propA: valueA });

// Component just calls the store action:
await someStore.showSomeModal();
```

### Confirm Pattern

```typescript
const confirm = useConfirm();
confirm.open({
  title: t("@confirms.deleteItem.title"),
  description: t("@confirms.deleteItem.description"),
  onConfirm: () => {
    // proceed with destructive action
  },
});
```

### `PanelChangesFooter`

Appears at the bottom of configuration panels when `isChanged` is `true`. Provides Save / Discard buttons. Connect to the relevant store's `isChanged` flag.

### `RTEditor` (Tiptap)

Rich text editor for question labels and section text. Supports text alignment extension. Use instead of `<textarea>` for HTML content fields.

### `CodeEditor` (Monaco)

Used in expression/code editing contexts: custom function body, engine definitions. Wraps `nuxt-monaco-editor`. Use for multi-line JavaScript code input.

### `JsonForms`

Dynamic form generation from JSON Schema. Used in:

- `DesignerFunctionsPanel` — function definition form
- `JsonFormModal` — generic modal with any JSON Schema form
- Configuration panels using plugin-defined schemas

Custom renderers override all default `@jsonforms/vue-vanilla` renderers. See `app/utils/jsonFormRenderer.ts` for the renderer registry and priority order.

### `ExtendableSlot`

Allows external code (plugins) to inject content into specific locations in the UI. Backed by `useExtendableSlotsStore`. Use `<ExtendableSlot name="slot-name" />` to define an injection point.
