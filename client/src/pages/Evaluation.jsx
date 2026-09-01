import React from 'react';
import EvaluationBenchmarking from '../components/EvaluationBenchmarking';

const Evaluation = () => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1">
          EMPIRICAL SYSTEM EVALUATION
        </p>
        <h1 className="text-3xl font-extrabold text-white">System Benchmarking</h1>
      </div>

      <EvaluationBenchmarking />
    </div>
  );
};

export default Evaluation;
