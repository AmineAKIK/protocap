import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PackingPlanningRail, type PackingPlanningFormState } from './PackingPlanningRail';

const form: PackingPlanningFormState = {
  quantity: '',
  unitsPerCarton: '',
  cartonsPerPalette: '',
  productionStartTime: '',
  referenceCadence: '',
};

function renderPlanningRail() {
  render(
    <PackingPlanningRail
      form={form}
      input={null}
      calculation={null}
      selectedPolicy={null}
      fieldErrors={{}}
      combinationInvalid={false}
      canLaunch={false}
      launchGuidance="À compléter : Quantité demandée"
      isLaunching={false}
      hasPreparationData={false}
      persistenceDegraded={false}
      onFieldChange={vi.fn()}
      onFieldBlur={vi.fn()}
      onSelectPolicy={vi.fn()}
      onLaunch={vi.fn()}
      onReset={vi.fn()}
    />,
  );
}

afterEach(() => {
  Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker');
  vi.restoreAllMocks();
});

describe('PackingPlanningRail OC start picker', () => {
  it('uses the styled left trigger to open the native datetime picker', () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    });

    renderPlanningRail();

    const input = screen.getByLabelText('Début OC') as HTMLInputElement;
    expect(input.type).toBe('datetime-local');
    expect(input.classList.contains('packing-v3-datetime-input')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Choisir la date et l’heure de début OC' }));

    expect(showPicker).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
  });

  it('falls back to clicking the datetime input when showPicker is unavailable', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    renderPlanningRail();

    const input = screen.getByLabelText('Début OC') as HTMLInputElement;
    expect('showPicker' in input).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Choisir la date et l’heure de début OC' }));

    expect(click).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
  });
});
