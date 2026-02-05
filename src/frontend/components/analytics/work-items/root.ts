

function WorkItems() {
  return (
    <AnalyticsWrapper i18nTitle="sidebar.work_items">
      <div className="flex flex-col gap-14">
        <TotalInsights analyticsType="work-items" />
        <CreatedVsResolved />
        <CustomizedInsights />
        <WorkItemsInsightTable />
      </div>
    </AnalyticsWrapper>
  );
}

export { WorkItems };
