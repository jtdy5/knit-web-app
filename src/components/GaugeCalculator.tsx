import React, { useState } from 'react';
import { Project, GaugeData } from '../lib/store';

interface Props {
  project: Project;
  onUpdate: (project: Project) => void;
}

export function GaugeCalculator({ project, onUpdate }: Props) {
  const gauge: GaugeData = project.gauge || { 
    stitches: 20, rows: 26, width: 10, length: 10, unit: 'cm',
    patternStitches: 20, patternRows: 26, patternWidth: 10, patternLength: 10
  };
  const [targetWidth, setTargetWidth] = useState<number | ''>('');
  const [desiredMeasurement, setDesiredMeasurement] = useState<number | ''>('');

  const updateGauge = (updates: Partial<GaugeData>) => {
    onUpdate({ ...project, gauge: { ...gauge, ...updates } });
  };

  const stsPerUnit = gauge.width > 0 ? gauge.stitches / gauge.width : 0;
  const rowsPerUnit = gauge.length > 0 ? gauge.rows / gauge.length : 0;

  const patternStsPerUnit = (gauge.patternWidth && gauge.patternStitches) ? gauge.patternStitches / gauge.patternWidth : 0;
  const patternRowsPerUnit = (gauge.patternLength && gauge.patternRows) ? gauge.patternRows / gauge.patternLength : 0;

  const stsPer10 = gauge.unit === 'cm' ? stsPerUnit * 10 : stsPerUnit * 4;
  const rowsPer10 = gauge.unit === 'cm' ? rowsPerUnit * 10 : rowsPerUnit * 4;

  const patternStsPer10 = gauge.unit === 'cm' ? patternStsPerUnit * 10 : patternStsPerUnit * 4;
  const patternRowsPer10 = gauge.unit === 'cm' ? patternRowsPerUnit * 10 : patternRowsPerUnit * 4;

  const targetStitches = targetWidth ? Math.round(Number(targetWidth) * stsPerUnit) : 0;

  const gaugeRatio = (stsPerUnit > 0 && patternStsPerUnit > 0) ? stsPerUnit / patternStsPerUnit : 0;
  const sizeToFollow = desiredMeasurement ? Number(desiredMeasurement) * gaugeRatio : 0;
  const stitchesNeeded = desiredMeasurement ? Number(desiredMeasurement) * stsPerUnit : 0;

  const getStitchRecommendation = () => {
    if (!patternStsPer10 || !stsPer10) return null;
    const diff = stsPer10 - patternStsPer10;
    if (Math.abs(diff) < 0.5) return <span className="text-green-600 font-medium">Spot on!</span>;
    if (diff > 0) return <span className="text-amber-600 font-medium">Your gauge is tighter ({diff.toFixed(1)} sts more). Try larger needles.</span>;
    return <span className="text-amber-600 font-medium">Your gauge is looser ({Math.abs(diff).toFixed(1)} sts less). Try smaller needles.</span>;
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-8 w-full">
      <div>
        <h2 className="text-2xl font-bold text-stone-800 mb-4">Gauge Calculator</h2>
        <p className="text-stone-600 mb-6">Compare your swatch to the pattern gauge.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pattern Gauge */}
          <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-stone-700 border-b border-stone-100 pb-2">Pattern Gauge</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-stone-500 mb-1">Stitches</label>
                <input type="number" min="0" value={gauge.patternStitches || ''} onChange={e => updateGauge({ patternStitches: Number(e.target.value) })} className="w-full p-2 border border-stone-300 rounded-lg" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-stone-500 mb-1">Rows</label>
                <input type="number" min="0" value={gauge.patternRows || ''} onChange={e => updateGauge({ patternRows: Number(e.target.value) })} className="w-full p-2 border border-stone-300 rounded-lg" />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-stone-500 mb-1">Width</label>
                <input type="number" min="0" step="0.1" value={gauge.patternWidth || ''} onChange={e => updateGauge({ patternWidth: Number(e.target.value) })} className="w-full p-2 border border-stone-300 rounded-lg" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-stone-500 mb-1">Length</label>
                <input type="number" min="0" step="0.1" value={gauge.patternLength || ''} onChange={e => updateGauge({ patternLength: Number(e.target.value) })} className="w-full p-2 border border-stone-300 rounded-lg" />
              </div>
            </div>
          </div>

          {/* Swatch Gauge */}
          <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="font-semibold text-stone-700">Your Swatch</h3>
              <select 
                value={gauge.unit} 
                onChange={e => updateGauge({ unit: e.target.value as 'cm' | 'inch' })}
                className="text-sm border border-stone-300 rounded-md bg-stone-50 px-2 py-1"
              >
                <option value="cm">cm</option>
                <option value="inch">inches</option>
              </select>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-stone-500 mb-1">Stitches</label>
                <input type="number" min="0" value={gauge.stitches} onChange={e => updateGauge({ stitches: Number(e.target.value) })} className="w-full p-2 border border-stone-300 rounded-lg" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-stone-500 mb-1">Rows</label>
                <input type="number" min="0" value={gauge.rows} onChange={e => updateGauge({ rows: Number(e.target.value) })} className="w-full p-2 border border-stone-300 rounded-lg" />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-stone-500 mb-1">Width</label>
                <input type="number" min="0" step="0.1" value={gauge.width} onChange={e => updateGauge({ width: Number(e.target.value) })} className="w-full p-2 border border-stone-300 rounded-lg" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-stone-500 mb-1">Length</label>
                <input type="number" min="0" step="0.1" value={gauge.length} onChange={e => updateGauge({ length: Number(e.target.value) })} className="w-full p-2 border border-stone-300 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-stone-800 text-white p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Comparison (per {gauge.unit === 'cm' ? '10cm' : '4"'})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between items-end border-b border-stone-700 pb-2">
              <span className="text-stone-400">Pattern Stitches:</span>
              <span className="text-xl font-medium">{patternStsPer10 ? patternStsPer10.toFixed(1) : '-'}</span>
            </div>
            <div className="flex justify-between items-end border-b border-stone-700 pb-2">
              <span className="text-stone-400">Your Stitches:</span>
              <span className="text-2xl font-bold">{stsPer10 ? stsPer10.toFixed(1) : '-'}</span>
            </div>
            <div className="pt-2 text-sm">{getStitchRecommendation()}</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-end border-b border-stone-700 pb-2">
              <span className="text-stone-400">Pattern Rows:</span>
              <span className="text-xl font-medium">{patternRowsPer10 ? patternRowsPer10.toFixed(1) : '-'}</span>
            </div>
            <div className="flex justify-between items-end border-b border-stone-700 pb-2">
              <span className="text-stone-400">Your Rows:</span>
              <span className="text-2xl font-bold">{rowsPer10 ? rowsPer10.toFixed(1) : '-'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-800 mb-2">Pattern Size Adjustment</h3>
        <p className="text-sm text-stone-600 mb-6">
          Following the <a href="https://blog.tincanknits.com/2016/04/07/how-to-knit-a-garment-at-a-different-gauge/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Tin Can Knits method</a>, calculate which size to follow if your gauge doesn't match the pattern.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-stone-700 mb-1">Desired Finished Measurement ({gauge.unit})</label>
            <input type="number" min="0" step="0.1" value={desiredMeasurement} onChange={e => setDesiredMeasurement(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 100" className="w-full p-2 border border-stone-300 rounded-lg" />
            <p className="text-xs text-stone-500 mt-2">Enter the actual measurement you want the finished garment to have (e.g., your chest size + ease).</p>
          </div>
          <div className="flex-1">
            {sizeToFollow > 0 ? (
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                <div className="text-sm text-blue-800 mb-1">Follow the size with a finished measurement of:</div>
                <div className="text-3xl font-bold text-blue-900 mb-2">{sizeToFollow.toFixed(1)} {gauge.unit}</div>
                <div className="text-sm text-blue-700">
                  By following this size, you will cast on and work <strong>{Math.round(stitchesNeeded)} stitches</strong>, which at your gauge will give you your desired {desiredMeasurement}{gauge.unit}.
                </div>
              </div>
            ) : (
              <div className="bg-stone-50 border border-stone-200 p-4 rounded-lg text-sm text-stone-500 h-full flex items-center justify-center text-center">
                Enter a measurement and ensure both pattern and swatch gauges are filled out above.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-800 mb-4">Cast-on Calculator</h3>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm text-stone-500 mb-1">Target Width ({gauge.unit})</label>
            <input type="number" min="0" step="0.1" value={targetWidth} onChange={e => setTargetWidth(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 50" className="w-full p-2 border border-stone-300 rounded-lg" />
          </div>
          <div className="flex-1 pb-2">
            <div className="text-xl font-bold text-stone-800">{targetStitches} <span className="text-sm font-normal text-stone-500">stitches to cast on</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
