"use client";
import { PenLine, ChartNoAxesCombined, FlaskConical } from "lucide-react";
export type WorkspaceView = "draw" | "reconstruct" | "explore";
const views = [
  { id: "draw", label: "Draw", description: "Make a sketch", icon: PenLine },
  {
    id: "reconstruct",
    label: "Equations & graph",
    description: "Fit and edit curves",
    icon: ChartNoAxesCombined,
  },
  {
    id: "explore",
    label: "Explore math",
    description: "Compare and learn",
    icon: FlaskConical,
  },
] as const;
export default function WorkspaceTabs({
  value,
  onChange,
}: {
  value: WorkspaceView;
  onChange: (view: WorkspaceView) => void;
}) {
  return (
    <div
      className="workspace-navigation"
      role="tablist"
      aria-label="Main workspace"
    >
      {views.map(({ id, label, description, icon: Icon }, i) => (
        <button
          key={id}
          id={`tab-${id}`}
          role="tab"
          aria-label={label}
          aria-selected={value === id}
          aria-controls={`view-${id}`}
          tabIndex={value === id ? 0 : -1}
          onClick={() => onChange(id)}
          onKeyDown={(e) => {
            const index =
              e.key === "ArrowRight"
                ? (i + 1) % views.length
                : e.key === "ArrowLeft"
                  ? (i + views.length - 1) % views.length
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? views.length - 1
                      : null;
            if (index !== null) {
              e.preventDefault();
              onChange(views[index].id);
              document.getElementById(`tab-${views[index].id}`)?.focus();
            }
          }}
        >
          <Icon size={19} />
          <span>
            <strong>{label}</strong>
            <small>{description}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
