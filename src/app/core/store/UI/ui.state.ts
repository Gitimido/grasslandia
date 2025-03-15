export interface UIState {
  sidebar: {
    isCollapsed: boolean;
  };
  modals: {
    createPost: boolean;
    search: boolean;
    [key: string]: boolean;
  };
  toast: {
    show: boolean;
    message: string;
    toastType: 'success' | 'error' | 'info' | 'warning'; // Changed from 'type' to 'toastType'
  };
}

export const initialUIState: UIState = {
  sidebar: {
    isCollapsed: true,
  },
  modals: {
    createPost: false,
    search: false,
  },
  toast: {
    show: false,
    message: '',
    toastType: 'info', // Changed from 'type' to 'toastType'
  },
};
