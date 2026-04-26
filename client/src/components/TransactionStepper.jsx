import React, { useState } from 'react';
import { CheckCircle, Circle, Loader, ArrowRight, Shield, Brain, Link2, Zap } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Initiated', icon: Zap, description: 'Transaction submitted to network' },
  { id: 2, label: 'Validated', icon: Shield, description: 'KYC/AML checks passed' },
  { id: 3, label: 'AI Decision', icon: Brain, description: 'AI risk model evaluated' },
  { id: 4, label: 'Risk Check', icon: Shield, description: 'Compliance review completed' },
  { id: 5, label: 'Blockchain Confirmed', icon: Link2, description: 'Block mined & confirmed' },
];

const TransactionStepper = ({ currentStep = 0, isProcessing = false }) => {
  return (
    <div className="card">
      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
        <ArrowRight size={20} className="text-fintech-primary" />
        Transaction Flow
      </h3>

      <div className="relative">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isPending = currentStep < step.id;

          return (
            <div key={step.id} className="flex items-start gap-4 relative">
              {/* Vertical connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`absolute left-[19px] top-[40px] w-0.5 h-[calc(100%-8px)] transition-colors duration-500 ${
                    isCompleted ? 'bg-fintech-primary' : 'bg-slate-700'
                  }`}
                />
              )}

              {/* Step circle */}
              <div
                className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 transition-all duration-500 ${
                  isCompleted
                    ? 'bg-fintech-primary text-white shadow-lg shadow-emerald-500/30'
                    : isCurrent
                    ? 'bg-fintech-primary/20 text-fintech-primary border-2 border-fintech-primary animate-pulse'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle size={20} />
                ) : isCurrent && isProcessing ? (
                  <Loader size={20} className="animate-spin" />
                ) : (
                  <StepIcon size={18} />
                )}
              </div>

              {/* Step info */}
              <div className={`pb-8 ${index === STEPS.length - 1 ? 'pb-0' : ''}`}>
                <p
                  className={`font-semibold text-sm transition-colors duration-300 ${
                    isCompleted
                      ? 'text-fintech-primary'
                      : isCurrent
                      ? 'text-white'
                      : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TransactionStepper;
