type DashboardSectionHeadingProps = {
  label?: string;
  title: string;
  description?: string;
  level?: 1 | 2;
};

export function DashboardSectionHeading({ label, title, description, level = 2 }: DashboardSectionHeadingProps) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className="dashboard-section-heading zs:min-w-0">
      <div className="zs:min-w-0">
        {label && <span className="dashboard-section-index">{label}</span>}
        <Heading>{title}</Heading>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
