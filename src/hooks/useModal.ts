import React from "react";
import { Modal } from "@ui-kitten/components";

const useModal = () => {
  const modalRef = React.useRef<Modal>(null);
  const [visible, setVisible] = React.useState(false);

  const show = React.useCallback(() => {
    setVisible(true);
  }, []);

  const hide = React.useCallback(() => {
    setVisible(false);
  }, []);

  return { modalRef, visible, show, hide, setVisible };
};

export default useModal;
