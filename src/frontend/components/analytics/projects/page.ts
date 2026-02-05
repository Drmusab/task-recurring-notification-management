
const userService = new UserService();

export default function ProfileOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, userId } = params;

  const { t } = useTranslation();
  const { data: userProfile } = useSWR(USER_PROFILE_DATA(workspaceSlug, userId), () =>
    userService.getUserProfileData(workspaceSlug, userId)
  );

  const stateDistribution: IUserStateDistribution[] = Object.keys(GROUP_CHOICES).map((key) => {
    const group = userProfile?.state_distribution.find((g) => g.state_group === key);

    if (group) return group;
    else return { state_group: key as TStateGroups, state_count: 0 };
  });

  return (
    <>
      <PageHead title={t("profile.page_label")} />
      <ContentWrapper className="space-y-7">
        <ProfileStats userProfile={userProfile} />
        <ProfileWorkload stateDistribution={stateDistribution} />
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
          <ProfilePriorityDistribution userProfile={userProfile} />
          <ProfileStateDistribution stateDistribution={stateDistribution} userProfile={userProfile} />
        </div>
        <ProfileActivity />
      </ContentWrapper>
    </>
  );
}
