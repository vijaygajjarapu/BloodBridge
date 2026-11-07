import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Checkbox } from '../components/ui/Checkbox';
import { Badge, BloodGroupBadge, StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

describe('UI Component Library', () => {
  it('renders Button with proper text and minimum touch target size', () => {
    render(<Button>Donate Blood</Button>);
    const button = screen.getByRole('button', { name: /donate blood/i });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('min-h-[44px]');
  });

  it('renders Button loading state and disables interaction', () => {
    const handleClick = vi.fn();
    render(
      <Button isLoading onClick={handleClick}>
        Submit
      </Button>
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders Input with accessible label, error message, and aria attributes', () => {
    render(
      <Input
        label="Mobile Number"
        placeholder="Enter phone"
        error="Invalid phone format"
      />
    );
    const input = screen.getByLabelText(/mobile number/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid phone format');
  });

  it('toggles password visibility when toggle button is clicked', () => {
    render(<Input label="Password" type="password" />);
    const input = screen.getByLabelText(/^password$/i);
    expect(input).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByLabelText(/show password/i);
    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByLabelText(/hide password/i));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders Checkbox with description and handles checked state', () => {
    const handleChange = vi.fn();
    render(
      <Checkbox
        label="Emergency Contact Consent"
        description="Allow hospital dispatchers to call you"
        onChange={handleChange}
      />
    );
    const checkbox = screen.getByRole('checkbox', { name: /emergency contact consent/i });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/allow hospital dispatchers/i)).toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalled();
  });

  it('renders BloodGroupBadge and StatusBadge with appropriate styles', () => {
    const { rerender } = render(<BloodGroupBadge group="O-" />);
    expect(screen.getByText('O-')).toBeInTheDocument();

    rerender(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();

    rerender(<StatusBadge status="cooling_off" />);
    expect(screen.getByText('Rest Window')).toBeInTheDocument();
  });

  it('renders Modal dialog with escape key closing behavior', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Emergency Request">
        <div>Modal Body Content</div>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Emergency Request')).toBeInTheDocument();
    expect(screen.getByText('Modal Body Content')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders EmptyState with action trigger', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No Saviors Found"
        description="Try expanding your search radius"
        actionText="Reset Filter"
        onAction={handleAction}
      />
    );
    expect(screen.getByText('No Saviors Found')).toBeInTheDocument();
    const actionBtn = screen.getByRole('button', { name: /reset filter/i });
    fireEvent.click(actionBtn);
    expect(handleAction).toHaveBeenCalled();
  });
});
