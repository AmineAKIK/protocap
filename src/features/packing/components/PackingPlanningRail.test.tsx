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

afterEach(() => {
  Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker');
});

describe('PackingPlanningRail OC start picker', () => {
  it('uses the styled left trigger to open the native datetime picker', () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    });

    render(
      <PackingPlanningRail
        form={form}
        input={null}
        calculation={null}
        selectedPolicy={null}
        quantityInvalid={false}
        unitsPerCartonInvalid={false}
        cartonsPerPaletteInvalid={false}
        startTimeInvalid={false}
        cadenceInvalid={false}
        combinationInvalid={false}
        canLaunch={false}
        persistenceDegraded={false}
        onFieldChange={vi.fn()}
        onSelectPolicy={vi.fn()}
        onLaunch={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Début OC') as HTMLInputElement;
    expect(input.type).toBe('datetime-local');
    expect(input.classList.contains('packing-v3-datetime-input')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Choisir la date et l’heure de début OC' }));

    expect(showPicker).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
  });
});
