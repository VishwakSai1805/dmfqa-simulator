import { useMemo } from 'react';
import type { EngineId, ProcessInput, SimulationResult } from '../engine/types';
import { AGING_THRESHOLD } from '../engine/types';
import { styleMap, swatchBackground } from '../lib/palette';
import { Panel, Tip } from './Panel';

interface Props {
  result: SimulationResult;
  engine: EngineId;
  processes: ProcessInput[];
}

const num = 'py-[3px] pl-2 text-right font-mono text-[11.5px] tabular-nums';

export function ProcessTable({ result, engine, processes }: Props) {
  const styles = useMemo(() => styleMap(processes), [processes]);

  return (
    <Panel
      title="Processes"
      meta={engine === 'dmfqa' ? 'DMFQ-A' : 'baseline'}
      bodyClassName="overflow-auto px-3 pb-2"
    >
      <table className="w-full border-collapse">
        <thead className="bg-surface sticky top-0 z-10">
          <tr className="text-ink-4 text-[10.5px]">
            <th className="pb-1 text-left font-normal">id</th>
            <th className="pb-1 pl-2 text-right font-normal">at</th>
            <th className="pb-1 pl-2 text-right font-normal">bt</th>
            <th className="pb-1 pl-2 text-right font-normal">ct</th>
            <th className="pb-1 pl-2 text-right font-normal">tat</th>
            <th className="pb-1 pl-2 text-right font-normal">wt</th>
            <th className="pb-1 pl-2 text-right font-normal">rt</th>
            <th className="pb-1 pl-2 text-right font-normal">
              <Tip text="Longest continuous stretch this process spent ready without reaching the CPU. At or above 16 ms it counts as one starvation incident.">
                <span className="decoration-line-strong underline decoration-dotted underline-offset-2">
                  wait
                </span>
              </Tip>
            </th>
          </tr>
        </thead>
        <tbody>
          {result.finalProcesses.map((p) => {
            const st = styles.get(p.id);
            const starved = p.maxContinuousWait >= AGING_THRESHOLD;
            return (
              <tr key={p.id} className="border-line/60 border-t">
                <td className="py-[3px] text-left">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-[1px]"
                      style={{ background: st ? swatchBackground(st) : p.color }}
                    />
                    <span className="text-ink-2 text-[11.5px]">{p.id}</span>
                  </span>
                </td>
                <td className={`${num} text-ink-4`}>{p.arrivalTime}</td>
                <td className={`${num} text-ink-4`}>{p.burstTime}</td>
                <td className={`${num} text-ink-3`}>{p.completionTime}</td>
                <td className={`${num} text-ink-2`}>{p.turnaroundTime}</td>
                <td className={`${num} text-ink-2`}>{p.waitingTime}</td>
                <td className={`${num} text-ink-2`}>{p.responseTime}</td>
                <td className={`${num} ${starved ? 'text-s8' : 'text-ink-4'}`}>
                  {p.maxContinuousWait}
                  {starved && <span className="ml-0.5 text-[9px]">!</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-line-strong text-ink-4 border-t text-[10.5px]">
            <td className="py-[3px] text-left">mean</td>
            <td colSpan={3} />
            <td className={num}>{result.metrics.avgTAT.toFixed(2)}</td>
            <td className={num}>{result.metrics.avgWT.toFixed(2)}</td>
            <td className={num}>{result.metrics.avgRT.toFixed(2)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </Panel>
  );
}
