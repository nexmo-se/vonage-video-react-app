import React from 'react';
import { Button, CircularProgress } from '@mui/material';

export type PreappointmentButtonProps = {
  onClick: (event: React.MouseEvent) => void;
  label: string;
  color?: 'primary' | 'success' | 'error';
  disabled?: boolean;
  loading?: boolean;
};

const PreappointmentButton = ({
  onClick,
  label,
  color = 'primary',
  disabled = false,
  loading = false,
}: PreappointmentButtonProps): React.ReactElement => {
  return (
    <Button
      variant="contained"
      color={color}
      disabled={disabled || loading}
      sx={{
        textTransform: 'none',
        marginLeft: '8px',
        height: '48px',
        minWidth: '117px',
        borderRadius: '24px',
        color: 'white',
        fontSize: '14px',
      }}
      onClick={onClick}
      type="button"
    >
      {loading ? <CircularProgress size={20} color="inherit" /> : label}
    </Button>
  );
};

export default PreappointmentButton;
