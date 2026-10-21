import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ProcessInput } from './engine/types';
import { DEFAULT_PRESET_KEY, PRESETS } from './data/presets';
import { useScheduler } from './hooks/useScheduler';
import { Header, Transport } from './components/ControlsBar';
import { QueueVisualizer } from './components/QueueVisualizer';
import { GanttChart } from './components/GanttChart';
import { Interpretation, MetricsComparison } from './components/MetricsComparison';
import { MetricsChart } from './components/MetricsChart';
import { ProcessTable } from './components/ProcessTable';
import { AuditLog } from './components/AuditLog';
import { ProcessModal } from './components/ProcessModal';
import { printPresetSummary } from './lib/consoleSummary';

export default function App() {
  const [processes, setProcesses] = useState<ProcessInput[]>(
    () => PRESETS.find((p) => p.key === DEFAULT_PRESET_KEY)!.processes,
  );
  const [presetKey, setPresetKey] = useState<string | null>(DEFAULT_PRESET_KEY);
  const [modalOpen, setModalOpen] = useState(false);

  const scheduler = useScheduler(processes);
  const { engine, baseline, dmfqa, active, other, index, error } = scheduler;

  useEffect(() => {
    printPresetSummary();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        scheduler.togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        scheduler.stepForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        scheduler.stepBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scheduler, modalOpen]);

  const applyPreset = (key: string) => {
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setProcesses(preset.processes);
    setPresetKey(key);
  };

  const bar = {
    scheduler,
    activePresetKey: presetKey,
    onPreset: applyPreset,
    onOpenSandbox: () => setModalOpen(true),
    processCount: processes.length,
  };

  const otherKey = engine === 'dmfqa' ? ('baseline' as const) : ('dmfqa' as const);

  return (
    <div className="bg-surface flex h-full min-h-[740px] min-w-[1180px] flex-col overflow-hidden">
      <Header {...bar} />
      <Transport {...bar} />

      {error && (
        <div className="border-s8/40 bg-s8/10 text-s8 flex shrink-0 items-center gap-2 border-b px-4 py-2 text-[11.5px]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-mono">{error}</span>
        </div>
      )}

      {/* Main column grows to fill the viewport at any size; the log is a
          full-height rail because a transcript is the one thing that benefits
          from vertical room. */}
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="border-line shrink-0 border-b pb-1">
            <QueueVisualizer
              snapshot={active.snapshots[index]}
              engine={engine}
              processes={processes}
            />
          </div>

          <div className="border-line min-h-[148px] flex-[3] border-b">
            <GanttChart
              primary={active}
              primaryLabel={engine === 'dmfqa' ? 'DMFQ-A' : 'Baseline'}
              primaryKey={engine}
              secondary={other}
              secondaryLabel={otherKey === 'dmfqa' ? 'DMFQ-A' : 'Baseline'}
              secondaryKey={otherKey}
              currentTime={index}
              processes={processes}
            />
          </div>

          <div className="flex min-h-[206px] flex-[2]">
            <div className="w-[340px] shrink-0">
              <MetricsComparison baseline={baseline} dmfqa={dmfqa} />
            </div>
            <div className="border-line min-w-0 flex-1 border-l">
              <MetricsChart baseline={baseline} dmfqa={dmfqa} />
            </div>
            <div className="border-line w-[300px] shrink-0 border-l">
              <ProcessTable result={active} engine={engine} processes={processes} />
            </div>
          </div>

          <Interpretation baseline={baseline} dmfqa={dmfqa} />
        </main>

        <aside className="border-line flex w-[330px] shrink-0 flex-col border-l">
          <AuditLog result={active} index={index} />
        </aside>
      </div>

      <ProcessModal
        open={modalOpen}
        initial={processes}
        onClose={() => setModalOpen(false)}
        onApply={(p) => {
          setProcesses(p);
          setPresetKey(null);
        }}
      />
    </div>
  );
}
