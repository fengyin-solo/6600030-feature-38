<script setup lang="ts">
import { computed, onMounted } from 'vue';
import FEACanvas from './components/FEACanvas.vue';
import ElementInfo from './components/ElementInfo.vue';
import MeshControls from './components/MeshControls.vue';
import { useFEAStore } from './store/fea';

const store = useFEAStore();

onMounted(() => {
  store.loadPreset('cantilever');
});

const toastClass = computed(() => {
  switch (store.notification?.type) {
    case 'success':
      return 'border-green-500/50 bg-green-900/90 text-green-100';
    case 'error':
      return 'border-red-500/50 bg-red-900/90 text-red-100';
    case 'info':
    default:
      return 'border-sky-500/50 bg-sky-900/90 text-sky-100';
  }
});

const toastIcon = computed(() => {
  switch (store.notification?.type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'info':
    default:
      return 'ℹ';
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
    <!-- Header -->
    <header class="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <h1 class="text-lg font-bold text-purple-400">
        🔬 有限元应力热力图可视化
      </h1>
      <div class="text-xs text-slate-500">
        节点: {{ store.model.nodes.length }} |
        单元: {{ store.model.elements.length }}
      </div>
    </header>

    <!-- Main content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Canvas area -->
      <div class="flex-1 p-3" style="width: 75%">
        <FEACanvas />
      </div>

      <!-- Right sidebar -->
      <div class="w-[25%] min-w-[260px] bg-slate-900 border-l border-slate-800 p-3 flex flex-col gap-3 overflow-y-auto">
        <MeshControls />
        <ElementInfo />
      </div>
    </div>

    <!-- Bottom status bar -->
    <footer class="bg-slate-900 border-t border-slate-800 px-6 py-2 flex items-center gap-6 text-xs text-slate-400">
      <span>
        最大应力:
        <span class="text-red-400 font-bold">
          {{ store.result ? (store.maxStress / 1e6).toFixed(2) + ' MPa' : '—' }}
        </span>
      </span>
      <span>
        最大位移:
        <span class="text-amber-400 font-bold">
          {{ store.result ? (store.maxDisplacement * 1000).toFixed(3) + ' mm' : '—' }}
        </span>
      </span>
      <span>
        节点数: <span class="text-slate-200">{{ store.model.nodes.length }}</span>
      </span>
      <span>
        单元数: <span class="text-slate-200">{{ store.model.elements.length }}</span>
      </span>
      <span class="ml-auto text-slate-600">
        热力图: {{ store.heatmapMode }}
      </span>
    </footer>

    <!-- Solve feedback toast -->
    <Transition name="toast">
      <div
        v-if="store.notification"
        class="fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-lg border shadow-lg backdrop-blur text-xs font-medium flex items-center gap-3"
        :class="toastClass"
      >
        <span
          class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          :class="{
            'bg-green-500/30 text-green-300': store.notification.type === 'success',
            'bg-red-500/30 text-red-300': store.notification.type === 'error',
            'bg-sky-500/30 text-sky-300': store.notification.type === 'info',
          }"
        >
          {{ toastIcon }}
        </span>
        <span class="flex-1">{{ store.notification.message }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
