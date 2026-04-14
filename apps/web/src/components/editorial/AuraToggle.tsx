import React from "react";

interface AuraToggleProps {
  checked: boolean;
  onCheckChange: (val: boolean) => void;
}

export const AuraToggle: React.FC<AuraToggleProps> = ({ checked, onCheckChange }) => {
  return (
    <button
      type="button"
      onClick={() => onCheckChange(!checked)}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 22,
        background: checked ? "var(--accent-peach)" : "var(--warm-border-2)",
        border: "none",
        cursor: "pointer",
        transition: "background 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex",
        alignItems: "center",
        padding: 0,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          transform: checked ? "translateX(23px)" : "translateX(3px)",
        }}
      />
    </button>
  );
};
