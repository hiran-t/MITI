import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SettingsSearchContext, SettingsSection } from '../WidgetSettingsPortal';

function Draft() {
  const [value, setValue] = useState('original');
  return (
    <input
      aria-label="Draft topic"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

test('filtering and collapsing settings preserves unsaved input and reveals matching groups', () => {
  const view = (query: string) => (
    <SettingsSearchContext.Provider value={query}>
      <SettingsSection title="General" keywords="image topic">
        <Draft />
      </SettingsSection>
      <SettingsSection title="Scene">
        <span>Scene controls</span>
      </SettingsSection>
    </SettingsSearchContext.Provider>
  );
  const { rerender } = render(view(''));
  fireEvent.change(screen.getByLabelText('Draft topic'), { target: { value: '/custom/draft' } });
  fireEvent.click(screen.getByText('General'));
  expect(screen.getByText('General').closest('details')).not.toHaveAttribute('open');
  rerender(view('topic'));
  expect(screen.getByText('General').closest('details')).toHaveAttribute('open');
  expect(screen.getByText('Scene').closest('details')).toHaveAttribute('hidden');
  rerender(view('missing'));
  expect(screen.getByText('General').closest('details')).toHaveAttribute('hidden');
  rerender(view(''));
  expect(screen.getByLabelText('Draft topic')).toHaveValue('/custom/draft');
});
