export { GUIDED_STEPS, guideUrlFor } from './model/steps';
export type { GuidedStep, GuidedStepId } from './model/steps';
export {
  evaluateProgress,
  currentStep,
  currentGuidedStep,
  progressState,
  progressKnown,
  isFinished,
} from './model/useMigrationProgress';
export type { CurrentStep, ProgressState } from './model/useMigrationProgress';
export {
  guidanceOff,
  setGuidanceOff,
  welcomeSeen,
  markWelcomeSeen,
} from './model/guidedSetupPreferences';
export { installFirstVisitRedirect } from './model/firstVisitRedirect';
export { default as GuidedSetupWelcome } from './ui/GuidedSetupWelcome.vue';
export { default as GuidedStepBanner } from './ui/GuidedStepBanner.vue';
