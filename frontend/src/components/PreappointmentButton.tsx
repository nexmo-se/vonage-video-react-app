import { Button } from '@mui/material';
import { ReactElement } from 'react';

export type PreappointmentButtonProps = {
  onClick: (event: React.MouseEvent) => void;
  label: string;
  color?: 'primary' | 'success' | 'error';
  disabled?: boolean;
};

const colorMap = {
  primary: 'primary',
  success: 'success',
  error: 'error',
};

const PreappointmentButton = ({
  onClick,
  label,
  color = 'primary',
  disabled = false,
}: PreappointmentButtonProps): ReactElement => {
  return (
    <Button
      variant="contained"
      color={colorMap[color]}
      disabled={disabled}
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
      {label}
    </Button>
  );
};

export default PreappointmentButton;
