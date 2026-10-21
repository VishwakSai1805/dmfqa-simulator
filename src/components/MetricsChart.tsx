import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SimulationResult } from '../engine/types';
import { round2 } from '../engine/metrics';
import { ENGINE_COLOR } from '../lib/palette';
import { Panel, StatTile } from './Panel';
import { verdict } from './MetricsComparison';

interface Props {
  baseline: SimulationResult;
  dmfqa: SimulationResult;
}

/**
 * The three time averages share a unit and a scale, so they belong on one axis.
 * Starvation incidents and context switches are counts on a completely different
 * scale — putting them on the same axis renders them as invisible nubs, so they
 * get stat tiles instead. Same information, correct form; never a second y-axis.
 */
export function MetricsChart({ baseline, dmfqa }: Props) {
  const data = [
    { metric: 'Turnaround', Baseline: round2(baseline.metrics.avgTAT), 'DMFQ-A': round2(dmfqa.metrics.avgTAT) },
    { metric: 'Waiting', Baseline: round2(baseline.metrics.avgWT), 'DMFQ-A': round2(dmfqa.metrics.avgWT) },
    { metric: 'Response', Baseline: round2(baseline.metrics.avgRT), 'DMFQ-A': round2(dmfqa.metrics.avgRT) },
  ];

  const starv = verdict(
    baseline.metrics.starvationIncidents,
    dmfqa.metrics.starvationIncidents,
    'lower',
  );
  const cs = verdict(
    baseline.metrics.totalContextSwitches,
    dmfqa.metrics.totalContextSwitches,
    'lower',
  );

  return (
    <Panel
      title="Averages"
      meta="ms · lower is better"
      right={
        <span className="text-ink-3 flex shrink-0 items-center gap-3 text-[11px] whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-[1px]"
              style={{ background: ENGINE_COLOR.baseline }}
            />
            Baseline
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-[1px]"
              style={{ background: ENGINE_COLOR.dmfqa }}
            />
            DMFQ-A
          </span>
        </span>
      }
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="min-h-0 flex-1 pr-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, left: -26, bottom: -4 }} barGap={2}>
            <CartesianGrid stroke="#2c2c29" vertical={false} />
            <XAxis
              dataKey="metric"
              tick={{ fill: '#7e7c74', fontSize: 10.5 }}
              axisLine={{ stroke: '#2c2c29' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#7e7c74', fontSize: 10.5 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: '#ffffff', fillOpacity: 0.04 }}
              contentStyle={{
                background: '#212120',
                border: '1px solid #3a3a36',
                borderRadius: 4,
                fontSize: 11.5,
                padding: '6px 9px',
              }}
              labelStyle={{ color: '#b4b2a8', marginBottom: 2 }}
              itemStyle={{ padding: 0 }}
              formatter={(v, name) => [`${v} ms`, String(name)]}
            />
            <Bar dataKey="Baseline" fill={ENGINE_COLOR.baseline} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="DMFQ-A" fill={ENGINE_COLOR.dmfqa} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex shrink-0 gap-2 px-3 pt-2 pb-2">
        <StatTile
          label="Starvation incidents"
          values={[
            {
              name: 'b',
              value: String(baseline.metrics.starvationIncidents),
              color: ENGINE_COLOR.baseline,
              better: starv === 'baseline',
            },
            {
              name: 'd',
              value: String(dmfqa.metrics.starvationIncidents),
              color: ENGINE_COLOR.dmfqa,
              better: starv === 'dmfqa',
            },
          ]}
          note="processes waiting ≥ 16 ms uninterrupted"
        />
        <StatTile
          label="Context switches"
          values={[
            {
              name: 'b',
              value: String(baseline.metrics.totalContextSwitches),
              color: ENGINE_COLOR.baseline,
              better: cs === 'baseline',
            },
            {
              name: 'd',
              value: String(dmfqa.metrics.totalContextSwitches),
              color: ENGINE_COLOR.dmfqa,
              better: cs === 'dmfqa',
            },
          ]}
          note="between two real processes only"
        />
      </div>
    </Panel>
  );
}
