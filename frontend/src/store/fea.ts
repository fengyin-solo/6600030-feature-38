import { defineStore } from 'pinia';
import { ref, computed, nextTick } from 'vue';
import type { FEAModel, FEAResult } from '../types';
import {
  solve as feaSolve,
  presetCantileverBeam,
  presetBridgeTruss,
  presetSimpleFrame,
  jetColormap,
} from '../utils/fea-solver';

export const useFEAStore = defineStore('fea', () => {
  const model = ref<FEAModel>({ nodes: [], elements: [], loads: [] });
  const result = ref<FEAResult | null>(null);
  const selectedPreset = ref<string>('cantilever');
  const showDeformed = ref(false);
  const deformationScale = ref(10);
  const selectedElement = ref<number | null>(null);
  const heatmapMode = ref<'stress' | 'strain' | 'force'>('stress');

  // ─── Solve feedback state ────────────────────────────────────────────────
  const isSolving = ref(false);
  type SolveStage = 'idle' | 'assembling' | 'solving' | 'processing' | 'done';
  const solveStage = ref<SolveStage>('idle');
  const solveProgress = ref(0);

  type NotificationType = 'info' | 'success' | 'error';
  interface SolveNotification {
    id: number;
    message: string;
    type: NotificationType;
  }
  const notification = ref<SolveNotification | null>(null);
  let notificationSeq = 0;
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  function setNotification(
    message: string,
    type: NotificationType,
    duration = 0
  ) {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    const id = ++notificationSeq;
    notification.value = { id, message, type };
    if (duration > 0) {
      dismissTimer = setTimeout(() => {
        if (notification.value?.id === id) {
          notification.value = null;
        }
        dismissTimer = null;
      }, duration);
    }
  }

  function setSolveStage(stage: SolveStage, progress: number = 0) {
    solveStage.value = stage;
    solveProgress.value = progress;
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  function loadPreset(name: string) {
    selectedPreset.value = name;
    result.value = null;
    selectedElement.value = null;
    switch (name) {
      case 'cantilever':
        model.value = presetCantileverBeam();
        break;
      case 'bridge':
        model.value = presetBridgeTruss();
        break;
      case 'frame':
        model.value = presetSimpleFrame();
        break;
      default:
        model.value = presetCantileverBeam();
    }
  }

  async function solve() {
    if (isSolving.value) return;
    isSolving.value = true;
    setSolveStage('assembling', 10);
    setNotification('正在组装刚度矩阵…', 'info');

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const computeStart = performance.now();
    try {
      setSolveStage('assembling', 30);
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 30));

      setSolveStage('solving', 50);
      setNotification('正在求解线性方程组…', 'info');
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 20));

      result.value = feaSolve(model.value);
      const computeMs = performance.now() - computeStart;

      setSolveStage('processing', 80);
      setNotification('正在后处理计算结果…', 'info');
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const minVisibleMs = 350;
      const remaining = Math.max(0, minVisibleMs - computeMs);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      setSolveStage('done', 100);
      const stress = result.value
        ? ` · 最大应力 ${(result.value.maxStress / 1e6).toFixed(2)} MPa`
        : '';
      setNotification(`求解完成 ✓ 用时 ${computeMs.toFixed(0)} ms${stress}`, 'success', 2800);

      setTimeout(() => {
        setSolveStage('idle', 0);
      }, 500);
    } catch (err) {
      setSolveStage('idle', 0);
      setNotification(
        `求解失败：${err instanceof Error ? err.message : String(err)}`,
        'error',
        4000
      );
    } finally {
      isSolving.value = false;
    }
  }

  function toggleDeformed() {
    showDeformed.value = !showDeformed.value;
  }

  function selectElement(id: number | null) {
    selectedElement.value = id;
  }

  function setHeatmapMode(mode: 'stress' | 'strain' | 'force') {
    heatmapMode.value = mode;
  }

  function addLoad(nodeId: number, fx: number, fy: number) {
    model.value.loads.push({ nodeId, fx, fy });
  }

  function toggleFixed(nodeId: number) {
    const node = model.value.nodes.find((n) => n.id === nodeId);
    if (node) node.fixed = !node.fixed;
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const maxStress = computed(() => {
    if (!result.value) return 0;
    return result.value.maxStress;
  });

  const maxDisplacement = computed(() => {
    if (!result.value) return 0;
    return result.value.maxDisplacement;
  });

  const elementColors = computed(() => {
    const colors = new Map<number, string>();
    if (!result.value || model.value.elements.length === 0) {
      for (const el of model.value.elements) {
        colors.set(el.id, '#6b7280');
      }
      return colors;
    }

    let values: number[];
    switch (heatmapMode.value) {
      case 'stress':
        values = result.value.stresses.map(Math.abs);
        break;
      case 'strain':
        values = result.value.strains.map(Math.abs);
        break;
      case 'force':
        values = model.value.elements.map((e) => Math.abs(e.force));
        break;
      default:
        values = result.value.stresses.map(Math.abs);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    for (let i = 0; i < model.value.elements.length; i++) {
      colors.set(
        model.value.elements[i].id,
        jetColormap(values[i], min, max)
      );
    }
    return colors;
  });

  return {
    model,
    result,
    selectedPreset,
    showDeformed,
    deformationScale,
    selectedElement,
    heatmapMode,
    isSolving,
    solveStage,
    solveProgress,
    notification,
    maxStress,
    maxDisplacement,
    elementColors,
    loadPreset,
    solve,
    toggleDeformed,
    selectElement,
    setHeatmapMode,
    addLoad,
    toggleFixed,
    setSolveStage,
    setNotification,
  };
});
