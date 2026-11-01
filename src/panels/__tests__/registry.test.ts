import {
  getPanel,
  listPanels,
  registerPanels,
  subscribeToPanels,
  unregisterPanels,
} from '../registry';
import type { AnyPanelDefinition } from '../types';

const Component = () => null;
const panel = (type: string, label = type): AnyPanelDefinition => ({
  type,
  label,
  component: Component,
});

afterEach(() => {
  listPanels().forEach((p) => unregisterPanels(p.source));
});

test('lists built-in panels first, then widgets in the order they were registered', () => {
  registerPanels('builtin', [panel('topics'), panel('log')]);
  registerPanels('acme.vision', [panel('acme.vision/detections')]);
  registerPanels('acme.driver', [panel('acme.driver/status')]);
  expect(listPanels().map((p) => [p.type, p.source])).toEqual([
    ['topics', 'builtin'],
    ['log', 'builtin'],
    ['acme.vision/detections', 'acme.vision'],
    ['acme.driver/status', 'acme.driver'],
  ]);
});

test("a widget's panel types must start with its id and cannot take another source's type", () => {
  registerPanels('builtin', [panel('log')]);
  expect(() => registerPanels('acme.vision', [panel('detections')])).toThrow(
    'must start with "acme.vision/"'
  );
  registerPanels('acme.vision', [panel('acme.vision/detections')]);
  expect(() => registerPanels('acme', [panel('acme.vision/detections')])).toThrow(
    'must start with "acme/"'
  );
  expect(() => registerPanels('builtin', [panel('log'), panel('acme.vision/detections')])).toThrow(
    'belongs to acme.vision'
  );
  expect(getPanel('log')?.source).toBe('builtin');
});

test('rejects a definition without a label, a component or a unique type, and registers none', () => {
  expect(() => registerPanels('acme', [panel('acme/a'), panel('acme/b', '')])).toThrow(
    'needs a label'
  );
  expect(() =>
    registerPanels('acme', [{ type: 'acme/a', label: 'A' } as unknown as AnyPanelDefinition])
  ).toThrow('needs a component');
  expect(() => registerPanels('acme', [panel('acme/a'), panel('acme/a')])).toThrow('listed twice');
  expect(getPanel('acme/a')).toBeUndefined();
});

test('registering a widget again replaces its panels, with a new revision, and tells listeners', () => {
  const listener = jest.fn();
  const unsubscribe = subscribeToPanels(listener);
  registerPanels('acme', [panel('acme/a'), panel('acme/b')]);
  const first = getPanel('acme/a')!.revision;
  registerPanels('acme', [panel('acme/a', 'A v2')]);
  expect(getPanel('acme/a')).toMatchObject({ label: 'A v2' });
  expect(getPanel('acme/a')!.revision).toBeGreaterThan(first);
  expect(getPanel('acme/b')).toBeUndefined();
  unregisterPanels('acme');
  expect(getPanel('acme/a')).toBeUndefined();
  expect(listener).toHaveBeenCalledTimes(3);
  unsubscribe();
});
