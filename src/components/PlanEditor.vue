<script setup lang="ts">
defineProps<{ modelValue: string; error: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="editor">
    <textarea
      class="editor-area"
      :value="modelValue"
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
      aria-label="Macroplan TOML source"
      @input="onInput"
    ></textarea>
    <div v-if="error" class="editor-error" role="alert">
      <span class="font-semibold">Can’t parse:</span> {{ error }}
    </div>
  </div>
</template>

<style scoped>
.editor {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.editor-area {
  flex: 1;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  padding: 0.9rem 1rem;
  background: var(--color-base-100);
  color: var(--color-base-content);
  font-family: inherit; /* Fira Code, from the global theme */
  font-size: 0.8rem;
  line-height: 1.6;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
}
.editor-error {
  position: sticky;
  bottom: 0;
  padding: 0.6rem 1rem;
  font-size: 0.74rem;
  background: var(--color-error);
  color: var(--color-error-content);
  border-top: 1px solid color-mix(in oklch, black 12%, var(--color-error));
}
</style>
