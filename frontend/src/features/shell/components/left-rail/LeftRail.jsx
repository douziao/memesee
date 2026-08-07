import CommunityNav from "./CommunityNav";

export default function LeftRail({ shellProps, communityNavProps }) {
  const { isMobileViewport, routeType } = shellProps;

  return (
    <aside
      className={`left-rail ${
        isMobileViewport && routeType === "post" ? "is-hidden-mobile-post" : ""
      }`}
    >
      {!(isMobileViewport && routeType === "post") && (
        <CommunityNav {...communityNavProps} />
      )}
    </aside>
  );
}
