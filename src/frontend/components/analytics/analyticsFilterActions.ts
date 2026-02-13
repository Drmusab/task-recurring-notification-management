
const AnalyticsFilterActions = observer(function AnalyticsFilterActions() {
  const { selectedProjects, updateSelectedProjects } = useAnalytics();
  const { joinedProjectIds } = useProject();
  return (
    <div className="flex items-center justify-end gap-2">
      <ProjectSelect
        value={selectedProjects}
        onChange={(val) => {
          updateSelectedProjects(val ?? []);
        }}
        projectIds={joinedProjectIds}
      />
      {/* <DurationDropdown
        buttonVariant="border-with-text"
        value={selectedDuration}
        onChange={(val) => {
          updateSelectedDuration(val);
        }}
        dropdownArrow
      /> */}
    </div>
  );
});

export default AnalyticsFilterActions;
