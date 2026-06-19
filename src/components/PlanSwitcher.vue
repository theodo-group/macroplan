<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  plans: { id: string; name: string }[]
  activeId: string
}>()

const emit = defineEmits<{
  select: [id: string]
  new: []
  download: [id: string]
}>()

const activeName = computed(
  () => props.plans.find((p) => p.id === props.activeId)?.name ?? "Untitled",
)
</script>

<template>
  <div class="dropdown">
    <div tabindex="0" role="button" class="btn btn-ghost btn-sm gap-1 normal-case">
      <span class="max-w-[14rem] truncate font-semibold">{{ activeName }}</span>
      <span aria-hidden="true">▾</span>
    </div>
    <ul
      tabindex="0"
      class="menu dropdown-content z-50 mt-1 w-64 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
    >
      <li v-for="p in plans" :key="p.id">
        <a :class="{ active: p.id === activeId }" @click="emit('select', p.id)">
          <span class="truncate">{{ p.name }}</span>
          <span v-if="p.id === activeId" aria-hidden="true">✓</span>
        </a>
      </li>
      <div class="my-1 border-t border-base-200"></div>
      <li><a @click="emit('new')">＋ New plan</a></li>
      <li><a @click="emit('download', activeId)">⤓ Download .toml</a></li>
    </ul>
  </div>
</template>
