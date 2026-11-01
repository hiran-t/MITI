import { BUILTIN_SOURCE, registerPanels } from './registry';
import { BUILTIN_PANELS } from './builtin';

registerPanels(BUILTIN_SOURCE, BUILTIN_PANELS);

export * from './registry';
export type {
  AnyPanelDefinition,
  MitiClient,
  PanelDefinition,
  PanelProps,
  RegisteredPanel,
} from './types';
