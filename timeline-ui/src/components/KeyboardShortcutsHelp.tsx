import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  useTheme,
  Grid
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  description: string;
}

const shortcuts: ShortcutItem[] = [
  { key: '⌘/Ctrl + K', description: 'Focus search' },
  { key: '⌘/Ctrl + R', description: 'Refresh data' },
  { key: '→ or J', description: 'Next item' },
  { key: '← or K', description: 'Previous item' },
  { key: 'ESC', description: 'Close dialogs' },
  { key: '?', description: 'Show this help' },
];

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  open,
  onClose
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: theme.palette.background.default,
          borderBottom: `1px solid ${theme.palette.divider}`
        }}
      >
        <Typography variant="h6">Keyboard Shortcuts</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Grid container spacing={2}>
          {shortcuts.map((shortcut, index) => (
            <Grid item xs={12} key={index}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.5,
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: theme.palette.action.hover
                  }
                }}
              >
                <Typography variant="body1">{shortcut.description}</Typography>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    bgcolor: theme.palette.background.default,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: theme.palette.primary.main
                  }}
                >
                  {shortcut.key}
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsHelp; 