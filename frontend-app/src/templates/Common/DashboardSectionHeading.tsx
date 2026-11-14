type DashboardSectionHeadingProps = {
  label?: string;
  title: string;
  description?: string;
  level?: 1 | 2;
};

export function DashboardSectionHeading({ label, title, description, level = 2 }: DashboardSectionHeadingProps) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className="dashboard-section-heading">
      <div className="dashboard-section-heading-inner">
        {label && <span className="dashboard-section-index">{label}</span>}
        <Heading>{title}</Heading>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
