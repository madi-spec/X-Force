/**
 * Signal Events Module
 *
 * Exports all signal-related types, events, projections, and query functions.
 * Signals are the intelligence layer that bridges Command Center detection
 * to Work item creation/attachment.
 */

// Events and types
export * from './events';

// Projections and query functions
export * from './projections';

// Signal to Work pipeline
export * from './signalToWorkPipeline';

// Threshold configuration service
export * from './thresholdConfigService';
