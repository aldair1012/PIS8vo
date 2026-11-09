type DashboardSectionHeadingProps = {
  label?: string;
  title: string;
  description?: string;
};

export function DashboardSectionHeading({ label, title, description }: DashboardSectionHeadingProps) {
  return (
    <div className="dashboard-section-heading zs:min-w-0">
      <div className="zs:min-w-0">
        {label && <span className="dashboard-section-index">{label}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
